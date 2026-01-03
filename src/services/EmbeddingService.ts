/**
 * Embedding Service
 * Handles vector embedding generation and similarity search using Cloudflare Workers AI and Vectorize
 */

import type {
  Logger,
  PostVectorMetadata,
  RelatedPost,
  EmbeddingResult,
  BulkEmbeddingResult,
} from "../types";

// Cloudflare Workers AI BGE-M3 model
const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Workers AI embedding response type
interface WorkersAIEmbeddingResponse {
  shape: number[];
  data: number[][];
}

export class EmbeddingService {
  private vectorize: VectorizeIndex;
  private ai: Ai;

  constructor(vectorize: VectorizeIndex, ai: Ai) {
    this.vectorize = vectorize;
    this.ai = ai;
  }

  /**
   * Generate embedding for post content using Cloudflare Workers AI BGE-M3
   */
  async generateEmbedding(
    title: string,
    content: string,
    logger?: Logger
  ): Promise<number[]> {
    const textToEmbed = `${title}\n\n${content}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.ai.run(EMBEDDING_MODEL, {
          text: [textToEmbed],
        }) as WorkersAIEmbeddingResponse;

        if (!response.data?.[0]) {
          throw new Error("Invalid response from Workers AI");
        }

        const embedding = response.data[0];

        logger?.debug("Embedding generated", {
          model: EMBEDDING_MODEL,
          dimensions: embedding.length,
        });

        return embedding;
      } catch (error) {
        lastError = error as Error;
        logger?.warn(`Embedding generation attempt ${attempt + 1} failed`, {
          error: lastError.message,
        });

        if (attempt < MAX_RETRIES - 1) {
          await this.delay(RETRY_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error("Failed to generate embedding");
  }

  /**
   * Index a post's embedding in Vectorize
   */
  async indexPost(
    postId: number,
    title: string,
    content: string,
    slug: string,
    state: "draft" | "published",
    publishedAt: string | null,
    logger?: Logger
  ): Promise<EmbeddingResult> {
    try {
      const embedding = await this.generateEmbedding(title, content, logger);

      const vectorId = `post-${postId}`;
      const metadata: PostVectorMetadata = {
        postId,
        title,
        slug,
        state,
        publishedAt,
      };

      await this.vectorize.upsert([
        {
          id: vectorId,
          values: embedding,
          metadata: metadata as unknown as Record<string, VectorizeVectorMetadata>,
        },
      ]);

      logger?.info("Post indexed in Vectorize", { postId, vectorId });

      return {
        success: true,
        postId,
        vectorId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger?.error("Failed to index post", { postId, error: errorMessage });

      return {
        success: false,
        postId,
        error: errorMessage,
      };
    }
  }

  /**
   * Find similar posts using vector similarity
   */
  async findSimilarPosts(
    postId: number,
    topK: number = 4,
    logger?: Logger
  ): Promise<RelatedPost[]> {
    try {
      const vectorId = `post-${postId}`;

      // First, get the vector for the current post
      const vectors = await this.vectorize.getByIds([vectorId]);

      if (!vectors || vectors.length === 0 || !vectors[0].values) {
        logger?.debug("No vector found for post", { postId });
        return [];
      }

      // Query for similar vectors
      const results = await this.vectorize.query(vectors[0].values, {
        topK: topK + 1, // Get extra to filter out self
        returnMetadata: "all",
      });

      const now = new Date().toISOString();
      const relatedPosts: RelatedPost[] = results.matches
        .filter((match) => {
          if (match.id === vectorId) return false; // Exclude self
          const metadata = match.metadata as unknown as PostVectorMetadata;
          // Exclude unpublished or scheduled posts (publishedAt > now)
          if (metadata.publishedAt && metadata.publishedAt > now) return false;
          return true;
        })
        .slice(0, topK)
        .map((match) => {
          const metadata = match.metadata as unknown as PostVectorMetadata;
          return {
            id: metadata.postId,
            slug: metadata.slug,
            title: metadata.title,
            score: match.score,
          };
        });

      logger?.debug("Found similar posts", {
        sourcePostId: postId,
        count: relatedPosts.length,
      });

      return relatedPosts;
    } catch (error) {
      logger?.warn("Failed to find similar posts", {
        postId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // Return empty array on failure (graceful degradation)
      return [];
    }
  }

  /**
   * Delete a post's embedding from Vectorize
   */
  async deletePostEmbedding(postId: number, logger?: Logger): Promise<boolean> {
    try {
      const vectorId = `post-${postId}`;
      await this.vectorize.deleteByIds([vectorId]);

      logger?.info("Post embedding deleted", { postId, vectorId });
      return true;
    } catch (error) {
      logger?.warn("Failed to delete post embedding", {
        postId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Bulk index multiple posts (for migration)
   */
  async bulkIndexPosts(
    posts: Array<{
      id: number;
      title: string;
      content: string;
      slug: string;
      state: "draft" | "published";
      publishedAt: string | null;
    }>,
    logger?: Logger
  ): Promise<BulkEmbeddingResult> {
    const results: EmbeddingResult[] = [];

    for (const post of posts) {
      // Add delay between requests to avoid rate limiting
      if (results.length > 0) {
        await this.delay(200); // 200ms between requests
      }

      const result = await this.indexPost(
        post.id,
        post.title,
        post.content,
        post.slug,
        post.state,
        post.publishedAt,
        logger
      );

      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger?.info("Bulk indexing completed", {
      total: posts.length,
      succeeded,
      failed,
    });

    return {
      total: posts.length,
      succeeded,
      failed,
      results,
    };
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
