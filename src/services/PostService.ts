/**
 * Post Service
 * Business logic for post management
 */

import { PostRepository } from "../repositories";
import { EmbeddingService } from "./EmbeddingService";
import { ValidationError, NotFoundError } from "../utils/errors";
import {
  validatePostRequest,
  validatePagination,
  validateSorting,
} from "../utils/validation";
import type {
  Logger,
  PostWithTags,
  PostListItem,
  PaginatedResponse,
  RelatedPost,
  PostWithRelated,
} from "../types";

export class PostService {
  private repository: PostRepository;
  private embeddingService?: EmbeddingService;

  constructor(db: D1Database, vectorize?: VectorizeIndex, ai?: Ai) {
    this.repository = new PostRepository(db);

    // Only initialize embedding service if bindings are provided
    if (vectorize && ai) {
      this.embeddingService = new EmbeddingService(vectorize, ai);
    }
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async createPost(
    postData: Record<string, unknown>,
    logger?: Logger
  ): Promise<PostWithTags> {
    validatePostRequest(postData);

    const {
      title,
      content,
      summary,
      tags = [],
      state,
      locale = "ko",
      originalPostId = null,
      createdAt: requestedCreatedAt,
    } = postData as {
      title: string;
      content: string;
      summary: string;
      tags?: string[];
      state: string;
      locale?: string;
      originalPostId?: number | null;
      createdAt?: string;
    };
    let slug = postData.slug as string | undefined;

    if (!slug) {
      slug = this.generateSlug(title);
    }

    // Check slug uniqueness within the same locale (allows same slug for different locales)
    const existingPost = await this.repository.findBySlugAndLocale(slug, locale);
    if (existingPost) {
      throw new ValidationError("Slug already exists");
    }

    const now = new Date().toISOString();
    const createdAt = requestedCreatedAt || now;
    const postId = await this.repository.create({
      slug,
      title,
      content,
      summary,
      state,
      locale,
      originalPostId,
      createdAt,
      updatedAt: now,
    });

    if ((tags as string[]).length > 0) {
      await this.associateTags(postId, tags as string[], now);
    }

    const createdPost = await this.getPostWithTags(postId);

    // Trigger embedding generation (non-blocking)
    if (this.embeddingService && createdPost) {
      this.triggerEmbedding(createdPost, logger);
    }

    if (logger) {
      logger.info("Post created", { postId, slug, locale });
    }

    return createdPost!;
  }

  async updatePost(
    postId: number,
    postData: Record<string, unknown>,
    logger?: Logger
  ): Promise<PostWithTags> {
    validatePostRequest(postData);

    const existingPost = await this.repository.findById(postId);
    if (!existingPost) {
      throw new NotFoundError("Post not found");
    }

    const { title, content, summary, tags = [], state, slug, createdAt } = postData as {
      title: string;
      content: string;
      summary: string;
      tags?: string[];
      state: string;
      slug?: string;
      createdAt?: string;
    };

    if (slug) {
      // Check slug uniqueness within the same locale
      const slugConflict = await this.repository.findBySlugAndLocaleExcludingId(
        slug,
        existingPost.locale,
        postId
      );
      if (slugConflict) {
        throw new ValidationError("Slug already exists");
      }
    }

    const now = new Date().toISOString();
    await this.repository.update(postId, {
      title,
      content,
      summary,
      state,
      slug: slug || null,
      createdAt: createdAt || null,
      updatedAt: now,
    });

    await this.repository.deletePostTags(postId);

    if ((tags as string[]).length > 0) {
      await this.associateTags(postId, tags as string[], now);
    }

    const updatedPost = await this.getPostWithTags(postId);

    // Trigger embedding regeneration (non-blocking)
    if (this.embeddingService && updatedPost) {
      this.triggerEmbedding(updatedPost, logger);
    }

    if (logger) {
      logger.info("Post updated", { postId });
    }

    return updatedPost!;
  }

  async deletePost(
    postId: number,
    logger?: Logger
  ): Promise<{ deleted: boolean; id: number }> {
    const existingPost = await this.repository.findById(postId);
    if (!existingPost) {
      throw new NotFoundError("Post not found");
    }

    await this.repository.delete(postId);

    // Delete embedding (non-blocking)
    if (this.embeddingService) {
      this.embeddingService.deletePostEmbedding(postId, logger).catch((err) => {
        logger?.warn("Failed to delete embedding", {
          postId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });
    }

    if (logger) {
      logger.info("Post deleted", { postId });
    }

    return { deleted: true, id: postId };
  }

  private async associateTags(
    postId: number,
    tags: string[],
    timestamp: string
  ): Promise<void> {
    for (const tagName of tags) {
      const tag = await this.repository.findTagByName(tagName);

      let tagId: number;
      if (!tag) {
        tagId = await this.repository.createTag(tagName, timestamp);
      } else {
        tagId = tag.id;
      }

      await this.repository.createPostTag(postId, tagId);
    }
  }

  private async getPostWithTags(postId: number): Promise<PostWithTags | null> {
    const post = await this.repository.findById(postId);
    if (!post) {
      return null;
    }

    const tags = await this.repository.getTagsByPostId(postId);

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      summary: post.summary,
      tags,
      state: post.state,
      locale: post.locale,
      originalPostId: post.original_post_id,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      views: post.views,
    };
  }

  // Admin API methods
  async getAdminPosts(options: {
    locale?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<PaginatedResponse<PostListItem>> {
    const { locale, page = 0, size = 10, sort = "createdAt,desc" } = options;

    const paginationErrors = validatePagination({ page, size });
    if (paginationErrors.length > 0) {
      throw new ValidationError(paginationErrors.join(", "));
    }

    const allowedSortFields = ["createdAt", "updatedAt", "views", "title"];
    const sortErrors = validateSorting(sort, allowedSortFields);
    if (sortErrors.length > 0) {
      throw new ValidationError(sortErrors.join(", "));
    }

    const [sortField, sortDirection] = sort.split(",");

    const fieldMapping: Record<string, string> = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      views: "views",
      title: "title",
    };

    const dbSortField = fieldMapping[sortField] || sortField;
    const orderClause = `${dbSortField} ${sortDirection.toUpperCase()}`;

    const offset = page * size;

    const [posts, totalElements] = await Promise.all([
      this.repository.findAllAdmin({ locale, offset, limit: size, orderClause }),
      this.repository.countAdmin(locale),
    ]);

    const postIds = posts.map((p) => p.id);
    const tagsByPost = await this.repository.getTagsForPosts(postIds);

    const now = new Date().toISOString();
    const postsWithTags: PostListItem[] = posts.map((post) => {
      // Determine display state: if published but created_at is in future, it's "scheduled"
      let displayState: "draft" | "published" | "scheduled" = post.state;
      if (post.state === "published" && post.created_at > now) {
        displayState = "scheduled";
      }

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        summary: post.summary,
        tags: tagsByPost.get(post.id) || [],
        state: displayState,
        locale: post.locale,
        originalPostId: post.original_post_id,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        views: post.views,
      };
    });

    return {
      content: postsWithTags,
      totalElements,
      pageNumber: page,
      pageSize: size,
    };
  }

  // Public API methods
  async getPosts(options: {
    tag?: string | null;
    locale?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<PaginatedResponse<PostListItem>> {
    const { tag = null, locale = "ko", page = 0, size = 10, sort = "createdAt,desc" } = options;

    const paginationErrors = validatePagination({ page, size });
    if (paginationErrors.length > 0) {
      throw new ValidationError(paginationErrors.join(", "));
    }

    const allowedSortFields = ["createdAt", "updatedAt", "views", "title"];
    const sortErrors = validateSorting(sort, allowedSortFields);
    if (sortErrors.length > 0) {
      throw new ValidationError(sortErrors.join(", "));
    }

    const [sortField, sortDirection] = sort.split(",");

    const fieldMapping: Record<string, string> = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      views: "views",
      title: "title",
    };

    const dbSortField = fieldMapping[sortField] || sortField;
    const orderClause = `${dbSortField} ${sortDirection.toUpperCase()}`;

    const offset = page * size;

    const [posts, totalElements] = await Promise.all([
      this.repository.findAll({ tag, locale, offset, limit: size, orderClause }),
      this.repository.count(tag, locale),
    ]);

    const postIds = posts.map((p) => p.id);
    const tagsByPost = await this.repository.getTagsForPosts(postIds);

    const postsWithTags: PostListItem[] = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: tagsByPost.get(post.id) || [],
      state: post.state,
      locale: post.locale,
      originalPostId: post.original_post_id,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      views: post.views,
    }));

    return {
      content: postsWithTags,
      totalElements,
      pageNumber: page,
      pageSize: size,
    };
  }

  async getPostBySlug(
    slug: string,
    locale?: string
  ): Promise<
    { redirect: true; slug: string; locale?: string } | { redirect: false; data: PostWithTags & { availableLocales: { locale: string; slug: string }[] } }
  > {
    if (!slug) {
      throw new ValidationError("Slug parameter is required");
    }

    const isNumericId = /^\d+$/.test(slug);

    if (isNumericId) {
      const post = await this.repository.findPublishedById(parseInt(slug, 10));

      if (!post) {
        throw new NotFoundError("Post not found");
      }

      return {
        redirect: true,
        slug: post.slug,
        locale: post.locale,
      };
    }

    const post = await this.repository.findPublishedBySlug(slug);

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    // If locale is specified and doesn't match, try to find the translation
    if (locale && post.locale !== locale) {
      // Find if there's a version in the requested locale
      const originalId = post.original_post_id || post.id;
      const translation = await this.repository.findTranslation(originalId, locale);
      if (translation) {
        return {
          redirect: true,
          slug: translation.slug,
          locale: translation.locale,
        };
      }
    }

    const tags = await this.repository.getTagsForPost(post.id);

    // Get all available language versions
    const originalId = post.original_post_id || post.id;
    const allVersions = await this.repository.findAllLanguageVersions(originalId);
    const availableLocales = allVersions.map(v => ({ locale: v.locale, slug: v.slug }));

    // Get views from original post (unified view count)
    const unifiedViews = await this.repository.getViews(post.id) ?? post.views;

    return {
      redirect: false,
      data: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        summary: post.summary,
        tags,
        state: post.state,
        locale: post.locale,
        originalPostId: post.original_post_id,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        views: unifiedViews,
        availableLocales,
      },
    };
  }

  async incrementPostViews(postId: string | number): Promise<{ views: number }> {
    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = typeof postId === "number" ? postId : parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    await this.repository.incrementViews(id);

    const views = await this.repository.getViews(id);

    if (views === null) {
      throw new NotFoundError("Post not found");
    }

    return { views };
  }

  /**
   * Get post with related posts using vector similarity
   */
  async getPostBySlugWithRelated(
    slug: string,
    logger?: Logger
  ): Promise<
    | { redirect: true; slug: string }
    | { redirect: false; data: PostWithRelated }
  > {
    const result = await this.getPostBySlug(slug);

    if (result.redirect) {
      return result;
    }

    let relatedPosts: RelatedPost[] = [];

    if (this.embeddingService) {
      relatedPosts = await this.embeddingService.findSimilarPosts(
        result.data.id,
        4,
        logger
      );
    }

    return {
      redirect: false,
      data: {
        ...result.data,
        relatedPosts,
      },
    };
  }

  /**
   * Manual embedding generation trigger
   */
  async generateEmbeddingForPost(
    postId: number,
    logger?: Logger
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.embeddingService) {
      return { success: false, error: "Embedding service not configured" };
    }

    const post = await this.repository.findById(postId);
    if (!post) {
      return { success: false, error: "Post not found" };
    }

    const result = await this.embeddingService.indexPost(
      post.id,
      post.title,
      post.content,
      post.slug,
      post.state,
      post.state === "published" ? post.created_at : null,
      logger
    );

    return {
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Helper: Non-blocking embedding trigger
   */
  private triggerEmbedding(post: PostWithTags, logger?: Logger): void {
    this.embeddingService!.indexPost(
      post.id,
      post.title,
      post.content,
      post.slug,
      post.state,
      post.state === "published" ? post.createdAt : null,
      logger
    ).catch((err) => {
      logger?.warn("Background embedding failed", {
        postId: post.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    });
  }
}
