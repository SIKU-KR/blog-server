/**
 * Input Validation Utilities
 * Common validation functions for request data
 */

import { ValidationError } from "./errors";

/**
 * Validate required fields are present
 */
export function validateRequired(
  data: Record<string, unknown>,
  requiredFields: string[]
): void {
  const missing = requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(", ")}`);
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: unknown,
  fieldName: string,
  min: number,
  max?: number
): void {
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  const length = value.trim().length;

  if (length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters`);
  }

  if (max !== undefined && length > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max} characters`);
  }
}

/**
 * Validate slug format (lowercase alphanumeric with hyphens)
 */
export function validateSlug(slug: string): void {
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!slugPattern.test(slug)) {
    throw new ValidationError(
      "Slug must contain only lowercase letters, numbers, and hyphens (pattern: a-z0-9-)"
    );
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    throw new ValidationError("Invalid email format");
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T>(
  value: unknown,
  fieldName: string,
  allowedValues: T[]
): void {
  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`
    );
  }
}

/**
 * Validate array
 */
export function validateArray(
  value: unknown,
  fieldName: string,
  maxItems: number | null = null
): void {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (maxItems && value.length > maxItems) {
    throw new ValidationError(`${fieldName} must not exceed ${maxItems} items`);
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): void {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a number`);
  }

  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
  }
}

/**
 * Validate post creation/update request
 */
export function validatePostRequest(data: Record<string, unknown>): void {
  validateRequired(data, ["title", "content", "summary", "state"]);

  validateStringLength(data.title, "title", 1);
  validateStringLength(data.content, "content", 1);
  validateStringLength(data.summary, "summary", 1);
  validateEnum(data.state, "state", ["published", "draft"]);

  if (data.slug) {
    validateSlug(data.slug as string);
  }

  if (data.tags) {
    validateArray(data.tags, "tags", 20);
    (data.tags as unknown[]).forEach((tag, index) => {
      if (typeof tag !== "string" || tag.trim().length === 0) {
        throw new ValidationError(
          `Tag at index ${index} must be a non-empty string`
        );
      }
    });
  }
}

/**
 * Validate comment creation request
 */
export function validateCommentRequest(data: Record<string, unknown>): void {
  validateRequired(data, ["content", "author"]);

  validateStringLength(data.content, "content", 1, 500);
  validateStringLength(data.author, "author", 2, 20);
}

/**
 * Validate login request
 */
export function validateLoginRequest(
  data: Record<string, unknown>
): { valid: true } | { valid: false; error: string } {
  try {
    validateRequired(data, ["username", "password"]);
    validateStringLength(data.username, "username", 2, 50);
    validateStringLength(data.password, "password", 1, 100);

    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: {
  page?: string;
  size?: string;
}): { page: number; size: number } {
  const page = parseInt(params.page || "0", 10);
  const size = parseInt(params.size || "10", 10);

  if (isNaN(page) || page < 0) {
    throw new ValidationError("Page must be a non-negative integer");
  }

  if (isNaN(size) || size < 1 || size > 100) {
    throw new ValidationError("Size must be between 1 and 100");
  }

  return { page, size };
}

/**
 * Validate sort parameter
 */
export function validateSortParam(
  sort = "createdAt,desc",
  allowedFields = ["createdAt", "updatedAt", "views", "title"]
): { field: string; direction: string } {
  const [field, direction = "desc"] = sort.split(",");

  if (!allowedFields.includes(field)) {
    throw new ValidationError(
      `Sort field must be one of: ${allowedFields.join(", ")}`
    );
  }

  if (!["asc", "desc"].includes(direction.toLowerCase())) {
    throw new ValidationError('Sort direction must be "asc" or "desc"');
  }

  return { field, direction: direction.toLowerCase() };
}

/**
 * Validate pagination parameters (returns array of errors)
 */
export function validatePagination(params: {
  page?: number;
  size?: number;
}): string[] {
  const errors: string[] = [];
  const { page, size } = params;

  if (page !== undefined) {
    if (typeof page !== "number" || isNaN(page) || page < 0) {
      errors.push("Page must be a non-negative integer");
    }
  }

  if (size !== undefined) {
    if (typeof size !== "number" || isNaN(size) || size < 1 || size > 100) {
      errors.push("Size must be between 1 and 100");
    }
  }

  return errors;
}

/**
 * Validate sorting parameters (returns array of errors)
 */
export function validateSorting(sort: string, allowedFields: string[]): string[] {
  const errors: string[] = [];

  if (!sort || typeof sort !== "string") {
    errors.push("Sort parameter must be a string");
    return errors;
  }

  const [field, direction = "desc"] = sort.split(",");

  if (!allowedFields.includes(field)) {
    errors.push(`Sort field must be one of: ${allowedFields.join(", ")}`);
  }

  if (!["asc", "desc"].includes(direction.toLowerCase())) {
    errors.push('Sort direction must be "asc" or "desc"');
  }

  return errors;
}

/**
 * Validate comment creation data (returns array of errors)
 */
export function validateCreateComment(data: {
  content?: unknown;
  author?: unknown;
}): string[] {
  const errors: string[] = [];

  if (!data.content || typeof data.content !== "string") {
    errors.push("Content is required and must be a string");
  } else if (data.content.trim().length < 1 || data.content.length > 500) {
    errors.push("Content must be between 1 and 500 characters");
  }

  if (!data.author || typeof data.author !== "string") {
    errors.push("Author is required and must be a string");
  } else if (data.author.trim().length < 2 || data.author.length > 20) {
    errors.push("Author must be between 2 and 20 characters");
  }

  return errors;
}
