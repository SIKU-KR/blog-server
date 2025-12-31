/**
 * Authentication Routes
 * POST /login - Admin login
 * GET /session - Validate session
 */

import { Hono } from "hono";
import { AuthService } from "../services";
import { authMiddleware } from "../auth";
import { toAPIError } from "../utils/errors";
import { createLogger } from "../utils/logger";
import type { Env } from "../types";

const auth = new Hono<{ Bindings: Env }>();

// POST /login - Admin login (public)
auth.post("/login", async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const body = await c.req.json();
    const authService = new AuthService();
    const result = await authService.login(body, c.env, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 400 | 401 | 500);
  }
});

// GET /session - Validate session (protected)
auth.get("/session", authMiddleware, async (c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();
  const logger = createLogger(requestId);

  try {
    const user = c.get("user");
    const authService = new AuthService();
    const result = await authService.validateSession(user, logger);

    return c.json(result, 200);
  } catch (error) {
    const apiError = toAPIError(error);
    return c.json({ error: apiError.message }, apiError.status as 401 | 500);
  }
});

export { auth };
