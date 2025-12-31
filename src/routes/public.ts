/**
 * Public Routes (no authentication required)
 *
 * GET /posts - List posts with pagination
 * GET /posts/:slug - Get single post
 * PATCH /posts/:postId/views - Increment view count
 * GET /comments/:postId - Get comments for post
 * POST /comments/:postId - Create comment
 * GET /tags - List active tags
 * GET /sitemap - Get sitemap
 */

import { Hono } from "hono";
import {
  PostService,
  CommentService,
  TagService,
  SitemapService,
} from "../services";
import { toAPIError } from "../utils/errors";
import { successResponse } from "../utils/response";
import type { Env } from "../types";

const publicRoutes = new Hono<{ Bindings: Env }>();

// GET /posts - List posts with pagination
publicRoutes.get("/posts", async (c) => {
  try {
    const tag = c.req.query("tag") || null;
    const page = parseInt(c.req.query("page") || "0", 10);
    const size = parseInt(c.req.query("size") || "10", 10);
    const sort = c.req.query("sort") || "createdAt,desc";

    const postService = new PostService(c.env.DB);
    const result = await postService.getPosts({ tag, page, size, sort });

    return c.json({
      success: true,
      data: result,
      error: null,
    }, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({
      success: false,
      data: null,
      error: {
        code: apiError.status,
        message: apiError.message,
      },
    }, apiError.status as 400 | 500);
  }
});

// GET /posts/:slug - Get single post with related posts
publicRoutes.get("/posts/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const postService = new PostService(
      c.env.DB,
      c.env.VECTORIZE,
      c.env.OPENAI_API_KEY
    );
    const result = await postService.getPostBySlugWithRelated(slug);

    // If numeric ID, redirect to slug URL
    if (result.redirect) {
      return c.redirect(`/posts/${result.slug}`, 301);
    }

    return c.json({
      success: true,
      data: result.data,
      error: null,
    }, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({
      success: false,
      data: null,
      error: {
        code: apiError.status,
        message: apiError.message,
      },
    }, apiError.status as 400 | 404 | 500);
  }
});

// PATCH /posts/:postId/views - Increment view count
publicRoutes.patch("/posts/:postId/views", async (c) => {
  try {
    const postId = c.req.param("postId");
    const postService = new PostService(c.env.DB);
    const result = await postService.incrementPostViews(postId);

    return c.json({
      success: true,
      data: result,
      error: null,
    }, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({
      success: false,
      data: null,
      error: {
        code: apiError.status,
        message: apiError.message,
      },
    }, apiError.status as 400 | 404 | 500);
  }
});

// GET /comments/:postId - Get comments for post
publicRoutes.get("/comments/:postId", async (c) => {
  try {
    const postId = c.req.param("postId");
    const commentService = new CommentService(c.env.DB);
    const result = await commentService.getCommentsByPostId(postId);

    return c.json({
      success: true,
      data: result,
      error: null,
    }, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({
      success: false,
      data: null,
      error: {
        code: apiError.status,
        message: apiError.message,
      },
    }, apiError.status as 400 | 404 | 500);
  }
});

// POST /comments/:postId - Create comment
publicRoutes.post("/comments/:postId", async (c) => {
  try {
    const postId = c.req.param("postId");
    const body = await c.req.json();
    const commentService = new CommentService(c.env.DB);
    const result = await commentService.createComment(postId, body);

    return c.json({
      success: true,
      data: result,
      error: null,
    }, 201);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({
      success: false,
      data: null,
      error: {
        code: apiError.status,
        message: apiError.message,
      },
    }, apiError.status as 400 | 404 | 500);
  }
});

// GET /tags - List active tags
publicRoutes.get("/tags", async (c) => {
  try {
    const tagService = new TagService(c.env.DB);
    const result = await tagService.getActiveTags();

    return c.json({
      success: true,
      data: result,
      error: null,
    }, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({
      success: false,
      data: null,
      error: {
        code: apiError.status,
        message: apiError.message,
      },
    }, apiError.status as 500);
  }
});

// GET /sitemap - Get sitemap
publicRoutes.get("/sitemap", async (c) => {
  try {
    const sitemapService = new SitemapService(c.env.DB);
    const result = await sitemapService.generateSitemap();

    return c.json({
      success: true,
      data: result,
      error: null,
    }, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({
      success: false,
      data: null,
      error: {
        code: apiError.status,
        message: apiError.message,
      },
    }, apiError.status as 500);
  }
});

export { publicRoutes };
