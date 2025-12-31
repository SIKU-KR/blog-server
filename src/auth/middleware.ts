/**
 * Authentication Middleware
 * JWT verification for protected routes
 */

import { Context, Next } from "hono";
import { validateJWT } from "./jwt";
import type { Env, JWTPayload } from "../types";

// Extend Hono context to include user
declare module "hono" {
  interface ContextVariableMap {
    user: JWTPayload;
    requestId: string;
  }
}

/**
 * JWT Authentication Middleware
 * Extracts and validates JWT from Authorization header
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Invalid or missing token" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = await validateJWT(token, c.env.JWT_SECRET);
    c.set("user", payload);
    await next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid or missing token";
    return c.json({ error: message }, 401);
  }
}

/**
 * Optional Auth Middleware
 * Attaches user to context if valid token present, but doesn't require it
 */
export async function optionalAuthMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const payload = await validateJWT(token, c.env.JWT_SECRET);
      c.set("user", payload);
    } catch {
      // Token is invalid, but we continue without user
    }
  }

  await next();
}
