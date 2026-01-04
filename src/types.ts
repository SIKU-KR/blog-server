/**
 * Type definitions for the blog server
 */

export interface Env {
  // D1 Database
  DB: D1Database;

  // R2 Storage
  STORAGE: R2Bucket;

  // Vectorize
  VECTORIZE: VectorizeIndex;

  // Workers AI
  AI: Ai;

  // Environment variables
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
  JWT_EXPIRY: string;
  CDN_DOMAIN: string;

  // Secrets
  JWT_SECRET: string;
  PASSWORD_SALT: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  OPENAI_API_KEY: string; // For AIGenerationService (summary/slug generation)
}

export interface JWTPayload {
  userId: number;
  iat: number;
  exp: number;
}

export type Locale = "ko" | "en";

export interface Post {
  id: number;
  slug: string;
  title: string;
  content: string;
  summary: string | null;
  state: "draft" | "published";
  locale: Locale;
  original_post_id: number | null;
  created_at: string;
  updated_at: string;
  views: number;
}

export interface PostWithTags {
  id: number;
  slug: string;
  title: string;
  content: string;
  summary: string | null;
  tags: string[];
  state: "draft" | "published";
  locale: Locale;
  originalPostId: number | null;
  createdAt: string;
  updatedAt: string;
  views: number;
}

export interface PostListItem {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  state: "draft" | "published" | "scheduled";
  locale: Locale;
  originalPostId: number | null;
  createdAt: string;
  updatedAt: string;
  views: number;
  hasTranslation?: boolean;
}

export interface Tag {
  id: number;
  name: string;
  created_at: string;
  post_count: number;
}

export interface Comment {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
  post_id: number;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  summary?: string;
  slug?: string;
  tags?: string[];
  state: "draft" | "published";
  locale?: Locale;
  originalPostId?: number;
}

export interface CreateCommentRequest {
  content: string;
  author: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  pageNumber: number;
  pageSize: number;
}

export interface Logger {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
}

// Embedding types
export interface PostVectorMetadata {
  postId: number;
  title: string;
  slug: string;
  state: "draft" | "published";
  publishedAt: string | null;
  locale: string;
}

export interface RelatedPost {
  id: number;
  slug: string;
  title: string;
  score: number;
}

export interface PostWithRelated extends PostWithTags {
  relatedPosts: RelatedPost[];
}

export interface EmbeddingResult {
  success: boolean;
  postId: number;
  vectorId?: string;
  error?: string;
}

export interface BulkEmbeddingResult {
  total: number;
  succeeded: number;
  failed: number;
  results: EmbeddingResult[];
}
