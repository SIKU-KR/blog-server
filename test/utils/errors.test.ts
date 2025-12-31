/**
 * Error utilities tests
 */

import { describe, it, expect } from "vitest";
import {
  APIError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  InternalServerError,
  toAPIError,
} from "../../src/utils/errors";

describe("Error Classes", () => {
  describe("APIError", () => {
    it("should create error with message and default status 400", () => {
      const error = new APIError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(400);
      expect(error.name).toBe("APIError");
    });

    it("should create error with custom status", () => {
      const error = new APIError("Test error", 500);
      expect(error.status).toBe(500);
    });
  });

  describe("ValidationError", () => {
    it("should create error with status 400", () => {
      const error = new ValidationError("Invalid input");
      expect(error.message).toBe("Invalid input");
      expect(error.status).toBe(400);
      expect(error.name).toBe("ValidationError");
    });
  });

  describe("NotFoundError", () => {
    it("should create error with status 404", () => {
      const error = new NotFoundError("Resource not found");
      expect(error.message).toBe("Resource not found");
      expect(error.status).toBe(404);
      expect(error.name).toBe("NotFoundError");
    });

    it("should use default message", () => {
      const error = new NotFoundError();
      expect(error.message).toBe("Resource not found");
    });
  });

  describe("UnauthorizedError", () => {
    it("should create error with status 401", () => {
      const error = new UnauthorizedError("Not authenticated");
      expect(error.message).toBe("Not authenticated");
      expect(error.status).toBe(401);
      expect(error.name).toBe("UnauthorizedError");
    });
  });

  describe("ForbiddenError", () => {
    it("should create error with status 403", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.message).toBe("Access denied");
      expect(error.status).toBe(403);
      expect(error.name).toBe("ForbiddenError");
    });
  });

  describe("ConflictError", () => {
    it("should create error with status 409", () => {
      const error = new ConflictError("Resource conflict");
      expect(error.message).toBe("Resource conflict");
      expect(error.status).toBe(409);
      expect(error.name).toBe("ConflictError");
    });
  });

  describe("InternalServerError", () => {
    it("should create error with status 500", () => {
      const error = new InternalServerError("Server error");
      expect(error.message).toBe("Server error");
      expect(error.status).toBe(500);
      expect(error.name).toBe("InternalServerError");
    });
  });
});

describe("toAPIError", () => {
  it("should return APIError as-is", () => {
    const original = new ValidationError("Test");
    const result = toAPIError(original);
    expect(result).toBe(original);
  });

  it("should convert not found error message", () => {
    const error = new Error("Resource not found");
    const result = toAPIError(error);
    expect(result).toBeInstanceOf(NotFoundError);
  });

  it("should convert unauthorized error message", () => {
    const error = new Error("User is unauthorized");
    const result = toAPIError(error);
    expect(result).toBeInstanceOf(UnauthorizedError);
  });

  it("should convert validation error message", () => {
    const error = new Error("input validation failed");
    const result = toAPIError(error);
    expect(result).toBeInstanceOf(ValidationError);
  });

  it("should convert conflict error message", () => {
    const error = new Error("Duplicate entry conflict");
    const result = toAPIError(error);
    expect(result).toBeInstanceOf(ConflictError);
  });

  it("should default to InternalServerError", () => {
    const error = new Error("Something went wrong");
    const result = toAPIError(error);
    expect(result).toBeInstanceOf(InternalServerError);
  });

  it("should handle non-Error objects", () => {
    const result = toAPIError("string error");
    expect(result).toBeInstanceOf(InternalServerError);
  });
});
