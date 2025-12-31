/**
 * Blog Server
 * Unified Cloudflare Worker combining admin and public API functionality
 *
 * Authentication Endpoints (Public):
 * - POST /login
 * - GET /session (requires auth)
 *
 * Admin Endpoints (Require JWT):
 * - POST /admin/posts
 * - PUT /admin/posts/:postId
 * - DELETE /admin/posts/:postId
 * - DELETE /admin/comments/:commentId
 * - POST /admin/images
 *
 * Public Endpoints:
 * - GET /posts
 * - GET /posts/:slug
 * - PATCH /posts/:postId/views
 * - GET /comments/:postId
 * - POST /comments/:postId
 * - GET /tags
 * - GET /sitemap
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth, admin, publicRoutes } from "./routes";
import {
  generateRequestId,
  logRequest,
  logResponse,
  logError,
} from "./utils/logger";
import type { Env } from "./types";

// Extend Hono context
declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

const app = new Hono<{ Bindings: Env }>();

// Request ID middleware
app.use("*", async (c, next) => {
  const requestId = generateRequestId();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
});

// Logging middleware
app.use("*", async (c, next) => {
  const requestId = c.get("requestId");
  const startTime = Date.now();

  logRequest(c.req.raw, requestId);

  try {
    await next();
    const duration = Date.now() - startTime;
    logResponse(c.req.raw, c.res, requestId, duration);
  } catch (error) {
    logError(error, c.req.raw, requestId);
    throw error;
  }
});

// CORS middleware
app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.ALLOWED_ORIGINS || "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

// Mount routes
app.route("/", auth); // /login, /session
app.route("/admin", admin); // /admin/posts, /admin/comments, /admin/images
app.route("/", publicRoutes); // /posts, /comments, /tags, /sitemap

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: 404,
        message: "Not found",
      },
    },
    404
  );
});

// Error handler
app.onError((error, c) => {
  const requestId = c.get("requestId");
  logError(error, c.req.raw, requestId);

  return c.json(
    {
      success: false,
      data: null,
      error: {
        code: 500,
        message: "Internal server error",
      },
    },
    500
  );
});

export default app;
