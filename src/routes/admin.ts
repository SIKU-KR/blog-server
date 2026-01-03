/**
 * Admin Routes
 * All routes require JWT authentication
 *
 * GET /admin/posts - List all posts (including scheduled)
 * POST /admin/posts - Create post
 * PUT /admin/posts/:postId - Update post
 * DELETE /admin/posts/:postId - Delete post
 * DELETE /admin/comments/:commentId - Delete comment
 * POST /admin/images - Upload image
 * POST /admin/posts/:postId/embed - Generate embedding for single post
 * POST /admin/posts/embed/bulk - Bulk generate embeddings for all posts
 * POST /admin/ai/summary - Generate AI summary for text
 * POST /admin/ai/slug - Generate AI slug from title and content
 */

import { Hono } from "hono";
import {
  PostService,
  CommentService,
  ImageService,
  EmbeddingService,
  AIGenerationService,
} from "../services";
import { PostRepository } from "../repositories";
import { authMiddleware } from "../auth";
import { toAPIError, ValidationError } from "../utils/errors";
import { createLogger } from "../utils/logger";
import type { Env } from "../types";

const admin = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all admin routes
admin.use("/*", authMiddleware);

// GET /admin/posts - List all posts (including scheduled)
admin.get("/posts", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const locale = c.req.query("locale") || undefined;
    const page = parseInt(c.req.query("page") || "0", 10);
    const size = parseInt(c.req.query("size") || "10", 10);
    const sort = c.req.query("sort") || "createdAt,desc";

    const postService = new PostService(c.env.DB);
    const result = await postService.getAdminPosts({ locale, page, size, sort });

    logger.info("Admin posts listed", { locale, page, size, total: result.totalElements });
    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 500);
  }
});

// GET /admin/posts/:postId - Get single post (any state)
admin.get("/posts/:postId", async (c) => {
  try {
    const postIdParam = c.req.param("postId");
    const postId = parseInt(postIdParam, 10);

    if (isNaN(postId)) {
      return c.json({ error: "Invalid post ID" }, 400);
    }

    const postRepository = new PostRepository(c.env.DB);
    const post = await postRepository.findById(postId);

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    const tags = await postRepository.getTagsByPostId(postId);

    return c.json({
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
    });
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 401 | 500);
  }
});

// POST /admin/posts - Create post
admin.post("/posts", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const body = await c.req.json();
    const postService = new PostService(c.env.DB, c.env.VECTORIZE, c.env.AI);
    const result = await postService.createPost(body, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 401 | 500);
  }
});

// PUT /admin/posts/:postId - Update post
admin.put("/posts/:postId", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const postIdParam = c.req.param("postId");
    const postId = parseInt(postIdParam, 10);

    if (isNaN(postId)) {
      throw new ValidationError("Invalid post ID");
    }

    const body = await c.req.json();
    const postService = new PostService(c.env.DB, c.env.VECTORIZE, c.env.AI);
    const result = await postService.updatePost(postId, body, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 404 | 500);
  }
});

// DELETE /admin/posts/:postId - Delete post
admin.delete("/posts/:postId", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const postIdParam = c.req.param("postId");
    const postId = parseInt(postIdParam, 10);

    if (isNaN(postId)) {
      throw new ValidationError("Invalid post ID");
    }

    const postService = new PostService(c.env.DB, c.env.VECTORIZE, c.env.AI);
    const result = await postService.deletePost(postId, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 404 | 500);
  }
});

// DELETE /admin/comments/:commentId - Delete comment
admin.delete("/comments/:commentId", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const commentId = c.req.param("commentId");
    const commentService = new CommentService(c.env.DB);
    const result = await commentService.deleteComment(commentId, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 404 | 500);
  }
});

// POST /admin/images - Upload image
admin.post("/images", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    const imageService = new ImageService(c.env.STORAGE, c.env.CDN_DOMAIN);
    const result = await imageService.uploadImage(file, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 500);
  }
});

// POST /admin/posts/:postId/embed - Generate embedding for single post
admin.post("/posts/:postId/embed", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const postIdParam = c.req.param("postId");
    const postId = parseInt(postIdParam, 10);

    if (isNaN(postId)) {
      throw new ValidationError("Invalid post ID");
    }

    const postService = new PostService(c.env.DB, c.env.VECTORIZE, c.env.AI);
    const result = await postService.generateEmbeddingForPost(postId, logger);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, postId }, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 404 | 500);
  }
});

// POST /admin/posts/embed/bulk - Bulk generate embeddings for all posts
admin.post("/posts/embed/bulk", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const postRepository = new PostRepository(c.env.DB);
    const embeddingService = new EmbeddingService(c.env.VECTORIZE, c.env.AI);

    // Get all posts
    const posts = await postRepository.findAllForEmbedding();

    const result = await embeddingService.bulkIndexPosts(
      posts.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        slug: p.slug,
        state: p.state,
        publishedAt: p.state === "published" ? p.created_at : null,
      })),
      logger
    );

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 500);
  }
});

// POST /admin/ai/summary - Generate AI summary for text
admin.post("/ai/summary", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const body = await c.req.json<{ text: string }>();

    if (!body.text || typeof body.text !== "string") {
      throw new ValidationError("Text is required");
    }

    if (body.text.length < 50) {
      throw new ValidationError("Text must be at least 50 characters");
    }

    const aiService = new AIGenerationService(c.env.OPENAI_API_KEY);
    const result = await aiService.generateSummary(body.text, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 500);
  }
});

// POST /admin/ai/slug - Generate AI slug from title and content
admin.post("/ai/slug", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const body = await c.req.json<{ title: string; text: string }>();

    if (!body.title || typeof body.title !== "string") {
      throw new ValidationError("Title is required");
    }

    if (!body.text || typeof body.text !== "string") {
      throw new ValidationError("Text is required");
    }

    const aiService = new AIGenerationService(c.env.OPENAI_API_KEY);
    const result = await aiService.generateSlug(body.title, body.text, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 500);
  }
});

// POST /admin/posts/:postId/translate - Translate post to target locale using AI
admin.post("/posts/:postId/translate", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const postIdParam = c.req.param("postId");
    const postId = parseInt(postIdParam, 10);

    if (isNaN(postId)) {
      throw new ValidationError("Invalid post ID");
    }

    const body = await c.req.json<{ targetLocale: string }>();
    const targetLocale = body.targetLocale || "en";

    if (targetLocale !== "en") {
      throw new ValidationError("Only English translation is supported");
    }

    // Get the original post
    const postRepository = new PostRepository(c.env.DB);
    const originalPost = await postRepository.findById(postId);

    if (!originalPost) {
      throw new ValidationError("Post not found");
    }

    if (originalPost.locale !== "ko") {
      throw new ValidationError("Only Korean posts can be translated");
    }

    // Check if translation already exists
    const existingTranslation = await postRepository.findTranslation(postId, targetLocale);
    if (existingTranslation) {
      throw new ValidationError("Translation already exists");
    }

    const AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct" as Parameters<typeof c.env.AI.run>[0];

    // Translate title using messages format
    logger.info("Translating title", { original: originalPost.title });

    const titleResponse = await c.env.AI.run(AI_MODEL, {
      messages: [
        { role: "system", content: "You are a Korean to English translator. Output only the translation, nothing else." },
        { role: "user", content: originalPost.title }
      ],
      max_tokens: 200,
    });

    const translatedTitle = (titleResponse as { response?: string }).response?.trim();
    logger.info("Title response", { translated: translatedTitle });

    if (!translatedTitle) {
      throw new ValidationError("AI failed to translate title");
    }

    // Translate content using messages format
    logger.info("Translating content", { length: originalPost.content.length });

    const contentResponse = await c.env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content: "You are a Korean to English translator for technical blog posts. Translate the Markdown content. Preserve all Markdown formatting, URLs, image paths, and code blocks. Only translate Korean text to English."
        },
        { role: "user", content: originalPost.content }
      ],
      max_tokens: 16384,
    });

    const translatedContent = (contentResponse as { response?: string }).response?.trim();
    logger.info("Content response", { length: translatedContent?.length });

    if (!translatedContent) {
      throw new ValidationError("AI failed to translate content");
    }

    // Translate summary
    let translatedSummary = originalPost.summary;
    if (originalPost.summary) {
      logger.info("Translating summary");

      const summaryResponse = await c.env.AI.run(AI_MODEL, {
        messages: [
          { role: "system", content: "Translate Korean to English. Max 200 characters. Output only the translation." },
          { role: "user", content: originalPost.summary }
        ],
        max_tokens: 256,
      });

      const rawSummary = (summaryResponse as { response?: string }).response?.trim();
      if (rawSummary) {
        translatedSummary = rawSummary.length > 200 ? rawSummary.substring(0, 197) + "..." : rawSummary;
      }
    }

    // Create the translated post as draft (keep original slug and createdAt)
    const postService = new PostService(c.env.DB, c.env.VECTORIZE, c.env.AI);
    const translatedPost = await postService.createPost({
      title: translatedTitle,
      content: translatedContent,
      summary: translatedSummary,
      slug: originalPost.slug,
      tags: await postRepository.getTagsByPostId(postId),
      state: "draft",
      locale: targetLocale,
      originalPostId: postId,
      createdAt: originalPost.created_at,
    }, logger);

    logger.info("Post translated successfully", {
      originalPostId: postId,
      translatedPostId: translatedPost.id,
      targetLocale,
      titleChanged: translatedTitle !== originalPost.title,
      contentLengthRatio: (translatedContent.length / originalPost.content.length).toFixed(2),
    });

    return c.json({
      success: true,
      originalPostId: postId,
      translatedPost,
    }, 200);
  } catch (error) {
    logger.error("Translation failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 404 | 500);
  }
});

export { admin };
