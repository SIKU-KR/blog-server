/**
 * Logger Utilities
 * Structured logging with request context and correlation IDs
 */

import type { Logger } from "../types";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Create a logger instance with request ID
 */
export function createLogger(requestId: string): Logger {
  const log = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      message,
      context,
    };

    // Output as JSON for structured logging
    console.log(JSON.stringify(entry));
  };

  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      log("DEBUG", message, context),
    info: (message: string, context?: Record<string, unknown>) =>
      log("INFO", message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      log("WARN", message, context),
    error: (message: string, context?: Record<string, unknown>) =>
      log("ERROR", message, context),
  };
}

/**
 * Log incoming request
 */
export function logRequest(request: Request, requestId: string): void {
  const logger = createLogger(requestId);
  const url = new URL(request.url);

  logger.info("Incoming request", {
    method: request.method,
    path: url.pathname,
    query: url.search,
    userAgent: request.headers.get("User-Agent") || "unknown",
  });
}

/**
 * Log response
 */
export function logResponse(
  request: Request,
  response: Response,
  requestId: string,
  duration: number
): void {
  const logger = createLogger(requestId);
  const url = new URL(request.url);

  logger.info("Response sent", {
    method: request.method,
    path: url.pathname,
    status: response.status,
    duration: `${duration}ms`,
  });
}

/**
 * Log error with context
 */
export function logError(
  error: unknown,
  request: Request,
  requestId: string,
  context?: Record<string, unknown>
): void {
  const logger = createLogger(requestId);
  const url = new URL(request.url);

  const errorInfo =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : { error: String(error) };

  logger.error("Request error", {
    method: request.method,
    path: url.pathname,
    ...errorInfo,
    ...context,
  });
}

/**
 * Create performance tracker
 */
export function createPerformanceTracker(
  logger: Logger,
  operation: string
): { end: () => number } {
  const startTime = Date.now();

  return {
    end: () => {
      const duration = Date.now() - startTime;
      logger.debug(`${operation} completed`, { duration: `${duration}ms` });
      return duration;
    },
  };
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
