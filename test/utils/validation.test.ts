/**
 * Validation utilities tests
 */

import { describe, it, expect } from "vitest";
import {
  validateRequired,
  validateStringLength,
  validateSlug,
  validateEnum,
  validateArray,
  validatePostRequest,
  validateLoginRequest,
  validatePagination,
  validateSorting,
  validateCreateComment,
} from "../../src/utils/validation";
import { ValidationError } from "../../src/utils/errors";

describe("validateRequired", () => {
  it("should pass when all required fields are present", () => {
    const data = { name: "test", email: "test@test.com" };
    expect(() => validateRequired(data, ["name", "email"])).not.toThrow();
  });

  it("should throw when field is missing", () => {
    const data = { name: "test" };
    expect(() => validateRequired(data, ["name", "email"])).toThrow(
      ValidationError
    );
  });

  it("should throw when field is empty string", () => {
    const data = { name: "", email: "test@test.com" };
    expect(() => validateRequired(data, ["name", "email"])).toThrow(
      ValidationError
    );
  });

  it("should throw when field is null", () => {
    const data = { name: null, email: "test@test.com" };
    expect(() => validateRequired(data, ["name", "email"])).toThrow(
      ValidationError
    );
  });
});

describe("validateStringLength", () => {
  it("should pass for valid string length", () => {
    expect(() => validateStringLength("hello", "field", 1, 10)).not.toThrow();
  });

  it("should throw for non-string", () => {
    expect(() => validateStringLength(123, "field", 1, 10)).toThrow(
      "field must be a string"
    );
  });

  it("should throw for too short string", () => {
    expect(() => validateStringLength("h", "field", 5, 10)).toThrow(
      "field must be at least 5 characters"
    );
  });

  it("should throw for too long string", () => {
    expect(() => validateStringLength("hello world", "field", 1, 5)).toThrow(
      "field must not exceed 5 characters"
    );
  });
});

describe("validateSlug", () => {
  it("should pass for valid slug", () => {
    expect(() => validateSlug("my-blog-post")).not.toThrow();
    expect(() => validateSlug("post123")).not.toThrow();
  });

  it("should throw for invalid slug", () => {
    expect(() => validateSlug("My Blog Post")).toThrow(ValidationError);
    expect(() => validateSlug("post_123")).toThrow(ValidationError);
    expect(() => validateSlug("-starts-with-dash")).toThrow(ValidationError);
  });
});

describe("validateEnum", () => {
  it("should pass for valid enum value", () => {
    expect(() =>
      validateEnum("published", "state", ["draft", "published"])
    ).not.toThrow();
  });

  it("should throw for invalid enum value", () => {
    expect(() =>
      validateEnum("active", "state", ["draft", "published"])
    ).toThrow("state must be one of: draft, published");
  });
});

describe("validateArray", () => {
  it("should pass for valid array", () => {
    expect(() => validateArray(["a", "b"], "tags")).not.toThrow();
  });

  it("should throw for non-array", () => {
    expect(() => validateArray("not-array", "tags")).toThrow(
      "tags must be an array"
    );
  });

  it("should throw when exceeding max items", () => {
    expect(() => validateArray(["a", "b", "c"], "tags", 2)).toThrow(
      "tags must not exceed 2 items"
    );
  });
});

describe("validatePostRequest", () => {
  const validPost = {
    title: "Test Post",
    content: "Test content here",
    summary: "Test summary",
    state: "published",
  };

  it("should pass for valid post", () => {
    expect(() => validatePostRequest(validPost)).not.toThrow();
  });

  it("should pass for valid post with optional fields", () => {
    expect(() =>
      validatePostRequest({
        ...validPost,
        slug: "test-post",
        tags: ["javascript", "web"],
      })
    ).not.toThrow();
  });

  it("should throw for missing required fields", () => {
    expect(() => validatePostRequest({ title: "Test" })).toThrow(
      ValidationError
    );
  });

  it("should throw for invalid state", () => {
    expect(() =>
      validatePostRequest({ ...validPost, state: "active" })
    ).toThrow(ValidationError);
  });

  it("should throw for invalid slug", () => {
    expect(() =>
      validatePostRequest({ ...validPost, slug: "Invalid Slug" })
    ).toThrow(ValidationError);
  });

  it("should throw for invalid tags", () => {
    expect(() =>
      validatePostRequest({ ...validPost, tags: ["valid", ""] })
    ).toThrow("Tag at index 1 must be a non-empty string");
  });
});

describe("validateLoginRequest", () => {
  it("should return valid for correct credentials", () => {
    const result = validateLoginRequest({
      username: "admin",
      password: "password123",
    });
    expect(result.valid).toBe(true);
  });

  it("should return invalid for missing username", () => {
    const result = validateLoginRequest({ password: "password123" });
    expect(result.valid).toBe(false);
    expect(result).toHaveProperty("error");
  });

  it("should return invalid for short username", () => {
    const result = validateLoginRequest({ username: "a", password: "password" });
    expect(result.valid).toBe(false);
  });
});

describe("validatePagination", () => {
  it("should return empty array for valid pagination", () => {
    const errors = validatePagination({ page: 0, size: 10 });
    expect(errors).toHaveLength(0);
  });

  it("should return error for negative page", () => {
    const errors = validatePagination({ page: -1, size: 10 });
    expect(errors).toContain("Page must be a non-negative integer");
  });

  it("should return error for size < 1", () => {
    const errors = validatePagination({ page: 0, size: 0 });
    expect(errors).toContain("Size must be between 1 and 100");
  });

  it("should return error for size > 100", () => {
    const errors = validatePagination({ page: 0, size: 101 });
    expect(errors).toContain("Size must be between 1 and 100");
  });
});

describe("validateSorting", () => {
  const allowedFields = ["createdAt", "updatedAt", "views"];

  it("should return empty array for valid sort", () => {
    const errors = validateSorting("createdAt,desc", allowedFields);
    expect(errors).toHaveLength(0);
  });

  it("should return error for invalid field", () => {
    const errors = validateSorting("invalidField,desc", allowedFields);
    expect(errors).toContain(
      "Sort field must be one of: createdAt, updatedAt, views"
    );
  });

  it("should return error for invalid direction", () => {
    const errors = validateSorting("createdAt,invalid", allowedFields);
    expect(errors).toContain('Sort direction must be "asc" or "desc"');
  });
});

describe("validateCreateComment", () => {
  it("should return empty array for valid comment", () => {
    const errors = validateCreateComment({
      content: "This is a comment",
      author: "John Doe",
    });
    expect(errors).toHaveLength(0);
  });

  it("should return error for missing content", () => {
    const errors = validateCreateComment({ author: "John Doe" });
    expect(errors).toContain("Content is required and must be a string");
  });

  it("should return error for content too long", () => {
    const errors = validateCreateComment({
      content: "a".repeat(501),
      author: "John Doe",
    });
    expect(errors).toContain("Content must be between 1 and 500 characters");
  });

  it("should return error for author too short", () => {
    const errors = validateCreateComment({
      content: "Valid content",
      author: "J",
    });
    expect(errors).toContain("Author must be between 2 and 20 characters");
  });
});
