/**
 * Admin Routes
 * All routes require JWT authentication
 *
 * POST /admin/posts - Create post
 * PUT /admin/posts/:postId - Update post
 * DELETE /admin/posts/:postId - Delete post
 * DELETE /admin/comments/:commentId - Delete comment
 * POST /admin/images - Upload image
 */

import { Hono } from "hono";
import { PostService, CommentService, ImageService } from "../services";
import { authMiddleware } from "../auth";
import { toAPIError, ValidationError } from "../utils/errors";
import { createLogger } from "../utils/logger";
import type { Env } from "../types";

const admin = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all admin routes
admin.use("/*", authMiddleware);

// POST /admin/posts - Create post
admin.post("/posts", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const body = await c.req.json();
    const postService = new PostService(c.env.DB);
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
    const postService = new PostService(c.env.DB);
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

    const postService = new PostService(c.env.DB);
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

export { admin };
