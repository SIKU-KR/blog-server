/**
 * Error Handling Utilities
 * Custom error classes for different error scenarios
 */

/**
 * Base API Error class
 */
export class APIError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}

/**
 * Validation Error - for input validation failures
 */
export class ValidationError extends APIError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

/**
 * Not Found Error - for missing resources
 */
export class NotFoundError extends APIError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

/**
 * Unauthorized Error - for authentication failures
 */
export class UnauthorizedError extends APIError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden Error - for authorization failures
 */
export class ForbiddenError extends APIError {
  constructor(message = "Forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Conflict Error - for resource conflicts
 */
export class ConflictError extends APIError {
  constructor(message = "Resource conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

/**
 * Internal Server Error - for unexpected server errors
 */
export class InternalServerError extends APIError {
  constructor(message = "Internal server error") {
    super(message, 500);
    this.name = "InternalServerError";
  }
}

/**
 * Convert any error to an APIError with appropriate status
 */
export function toAPIError(error: unknown): APIError {
  if (error instanceof APIError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred";

  // Map common error patterns to appropriate API errors
  if (message.includes("not found")) {
    return new NotFoundError(message);
  }

  if (message.includes("unauthorized") || message.includes("authentication")) {
    return new UnauthorizedError(message);
  }

  if (message.includes("forbidden") || message.includes("permission")) {
    return new ForbiddenError(message);
  }

  if (message.includes("validation") || message.includes("invalid")) {
    return new ValidationError(message);
  }

  if (message.includes("conflict") || message.includes("duplicate")) {
    return new ConflictError(message);
  }

  // Default to internal server error
  return new InternalServerError(message);
}
