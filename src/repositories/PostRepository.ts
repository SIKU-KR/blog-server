/**
 * Post Repository
 * Data access layer for posts
 */

import { postQueries, postTagQueries, tagQueries } from "../sql";
import type { Post } from "../types";

interface PostCreateData {
  slug: string;
  title: string;
  content: string;
  summary: string | null;
  state: string;
  locale: string;
  originalPostId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PostUpdateData {
  title: string;
  content: string;
  summary: string | null;
  state: string;
  slug: string | null;
  createdAt?: string | null;
  updatedAt: string;
}

export class PostRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async findById(id: number): Promise<Post | null> {
    return await this.db.prepare(postQueries.selectById).bind(id).first<Post>();
  }

  async findBySlug(slug: string): Promise<{ id: number } | null> {
    return await this.db
      .prepare(postQueries.selectBySlug)
      .bind(slug)
      .first<{ id: number }>();
  }

  async findBySlugAndLocale(slug: string, locale: string): Promise<{ id: number } | null> {
    return await this.db
      .prepare(postQueries.selectBySlugAndLocale)
      .bind(slug, locale)
      .first<{ id: number }>();
  }

  async findBySlugExcludingId(
    slug: string,
    id: number
  ): Promise<{ id: number } | null> {
    return await this.db
      .prepare(postQueries.selectBySlugExcludingId)
      .bind(slug, id)
      .first<{ id: number }>();
  }

  async findBySlugAndLocaleExcludingId(
    slug: string,
    locale: string,
    id: number
  ): Promise<{ id: number } | null> {
    return await this.db
      .prepare(postQueries.selectBySlugAndLocaleExcludingId)
      .bind(slug, locale, id)
      .first<{ id: number }>();
  }

  async create(postData: PostCreateData): Promise<number> {
    const { slug, title, content, summary, state, locale, originalPostId, createdAt, updatedAt } =
      postData;

    const result = await this.db
      .prepare(postQueries.insert)
      .bind(slug, title, content, summary, state, locale, originalPostId, createdAt, updatedAt)
      .run();

    return result.meta.last_row_id as number;
  }

  async update(id: number, postData: PostUpdateData): Promise<void> {
    const { title, content, summary, state, slug, createdAt, updatedAt } = postData;

    await this.db
      .prepare(postQueries.update)
      .bind(title, content, summary, state, slug, createdAt ?? null, updatedAt, id)
      .run();
  }

  async delete(id: number): Promise<void> {
    await this.db.prepare(postQueries.delete).bind(id).run();
  }

  async getTagsByPostId(postId: number): Promise<string[]> {
    const result = await this.db
      .prepare(postTagQueries.selectTagsByPostId)
      .bind(postId)
      .all<{ name: string }>();

    return result.results.map((t) => t.name);
  }

  async findTagByName(name: string): Promise<{ id: number } | null> {
    return await this.db
      .prepare(tagQueries.selectByName)
      .bind(name)
      .first<{ id: number }>();
  }

  async createTag(name: string, createdAt: string): Promise<number> {
    const result = await this.db
      .prepare(tagQueries.insert)
      .bind(name, createdAt)
      .run();

    return result.meta.last_row_id as number;
  }

  async deletePostTags(postId: number): Promise<void> {
    await this.db.prepare(postTagQueries.deleteByPostId).bind(postId).run();
  }

  async createPostTag(postId: number, tagId: number): Promise<void> {
    await this.db.prepare(postTagQueries.insert).bind(postId, tagId).run();
  }

  // Public API methods
  async findPublishedBySlug(slug: string): Promise<Post | null> {
    return await this.db
      .prepare(postQueries.selectPublishedBySlug)
      .bind(slug)
      .first<Post>();
  }

  async findPublishedBySlugAndLocale(slug: string, locale: string): Promise<Post | null> {
    return await this.db
      .prepare(postQueries.selectPublishedBySlugAndLocale)
      .bind(slug, locale)
      .first<Post>();
  }

  async findPublishedById(id: number): Promise<Post | null> {
    return await this.db
      .prepare(postQueries.selectPublishedById)
      .bind(id)
      .first<Post>();
  }

  async findAll(options: {
    tag?: string | null;
    locale?: string;
    offset?: number;
    limit?: number;
    orderClause?: string;
  }): Promise<Post[]> {
    const { tag = null, locale = "ko", offset = 0, limit = 10, orderClause = "created_at DESC" } = options;

    let query: string;
    let bindings: (string | number)[];

    if (tag) {
      query = `
        SELECT p.id, p.slug, p.title, p.summary, p.locale, p.original_post_id, p.created_at, p.updated_at,
          COALESCE(
            (SELECT op.views FROM posts op WHERE op.id = p.original_post_id),
            p.views
          ) as views
        FROM posts p
        WHERE p.state = 'published'
          AND p.locale = ?
          AND p.created_at <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          AND p.id IN (
            SELECT DISTINCT pt.post_id
            FROM post_tags pt
            INNER JOIN tags t ON pt.tag_id = t.id
            WHERE t.name = ?
          )
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      bindings = [locale, tag, limit, offset];
    } else {
      query = `
        SELECT p.id, p.slug, p.title, p.summary, p.locale, p.original_post_id, p.created_at, p.updated_at,
          COALESCE(
            (SELECT op.views FROM posts op WHERE op.id = p.original_post_id),
            p.views
          ) as views
        FROM posts p
        WHERE p.state = 'published' AND p.locale = ? AND p.created_at <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      bindings = [locale, limit, offset];
    }

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all<Post>();

    return result.results;
  }

  async count(tag: string | null = null, locale: string = "ko"): Promise<number> {
    let query: string;
    let bindings: string[];

    if (tag) {
      query = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM posts p
        INNER JOIN post_tags pt ON p.id = pt.post_id
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ? AND p.locale = ? AND p.state = 'published' AND p.created_at <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      `;
      bindings = [tag, locale];
    } else {
      query = `
        SELECT COUNT(*) as total
        FROM posts
        WHERE state = 'published' AND locale = ? AND created_at <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      `;
      bindings = [locale];
    }

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .first<{ total: number }>();

    return result?.total ?? 0;
  }

  async incrementViews(id: number): Promise<void> {
    // Get the post to check if it's a translation
    const post = await this.findById(id);
    if (!post) return;

    // If this is a translation, increment the original post's views
    const targetId = post.original_post_id || id;
    await this.db.prepare(postQueries.incrementViews).bind(targetId).run();
  }

  async getViews(id: number): Promise<number | null> {
    // Get the post to check if it's a translation
    const post = await this.findById(id);
    if (!post) return null;

    // If this is a translation, get the original post's views
    const targetId = post.original_post_id || id;
    const result = await this.db
      .prepare(postQueries.selectViews)
      .bind(targetId)
      .first<{ views: number }>();

    return result?.views ?? null;
  }

  async getTagsForPost(postId: number): Promise<string[]> {
    const query = `
      SELECT t.name
      FROM tags t
      INNER JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
      ORDER BY t.name
    `;

    const result = await this.db.prepare(query).bind(postId).all<{ name: string }>();
    return result.results.map((t) => t.name);
  }

  async getTagsForPosts(postIds: number[]): Promise<Map<number, string[]>> {
    if (!postIds || postIds.length === 0) {
      return new Map();
    }

    const placeholders = postIds.map(() => "?").join(",");
    const query = `
      SELECT pt.post_id, t.name
      FROM tags t
      INNER JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id IN (${placeholders})
      ORDER BY pt.post_id, t.name
    `;

    const result = await this.db
      .prepare(query)
      .bind(...postIds)
      .all<{ post_id: number; name: string }>();

    const tagsByPost = new Map<number, string[]>();
    for (const row of result.results) {
      if (!tagsByPost.has(row.post_id)) {
        tagsByPost.set(row.post_id, []);
      }
      tagsByPost.get(row.post_id)!.push(row.name);
    }

    return tagsByPost;
  }

  /**
   * Get IDs of posts that have been translated (have a translation pointing to them)
   */
  async getTranslatedOriginalIds(postIds: number[]): Promise<Set<number>> {
    if (postIds.length === 0) {
      return new Set();
    }

    const placeholders = postIds.map(() => "?").join(",");
    const query = `
      SELECT DISTINCT original_post_id
      FROM posts
      WHERE original_post_id IN (${placeholders})
    `;

    const result = await this.db
      .prepare(query)
      .bind(...postIds)
      .all<{ original_post_id: number }>();

    return new Set(result.results.map((r) => r.original_post_id));
  }

  /**
   * Get all posts for admin (no time filtering - includes scheduled posts)
   */
  async findAllAdmin(options: {
    locale?: string;
    offset?: number;
    limit?: number;
    orderClause?: string;
  }): Promise<Post[]> {
    const { locale, offset = 0, limit = 10, orderClause = "created_at DESC" } = options;

    let query: string;
    let bindings: (string | number)[];

    if (locale) {
      query = `
        SELECT p.id, p.slug, p.title, p.summary, p.state, p.locale, p.original_post_id, p.created_at, p.updated_at,
          COALESCE(
            (SELECT op.views FROM posts op WHERE op.id = p.original_post_id),
            p.views
          ) as views
        FROM posts p
        WHERE p.locale = ?
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      bindings = [locale, limit, offset];
    } else {
      query = `
        SELECT p.id, p.slug, p.title, p.summary, p.state, p.locale, p.original_post_id, p.created_at, p.updated_at,
          COALESCE(
            (SELECT op.views FROM posts op WHERE op.id = p.original_post_id),
            p.views
          ) as views
        FROM posts p
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      bindings = [limit, offset];
    }

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .all<Post>();

    return result.results;
  }

  /**
   * Count all posts for admin (no time filtering)
   */
  async countAdmin(locale?: string): Promise<number> {
    if (locale) {
      const query = `SELECT COUNT(*) as total FROM posts WHERE locale = ?`;
      const result = await this.db.prepare(query).bind(locale).first<{ total: number }>();
      return result?.total ?? 0;
    }
    const query = `SELECT COUNT(*) as total FROM posts`;
    const result = await this.db.prepare(query).first<{ total: number }>();
    return result?.total ?? 0;
  }

  /**
   * Find translation of a post
   */
  async findTranslation(originalPostId: number, locale: string): Promise<{ id: number; slug: string; locale: string } | null> {
    return await this.db
      .prepare(postQueries.selectTranslation)
      .bind(originalPostId, locale)
      .first<{ id: number; slug: string; locale: string }>();
  }

  /**
   * Get all language versions of a post (original + translations)
   */
  async findAllLanguageVersions(postId: number): Promise<{ id: number; slug: string; locale: string }[]> {
    const result = await this.db
      .prepare(postQueries.selectOriginalAndTranslations)
      .bind(postId, postId)
      .all<{ id: number; slug: string; locale: string }>();
    return result.results;
  }

  /**
   * Get all posts for bulk embedding migration
   */
  async findAllForEmbedding(): Promise<Post[]> {
    const query = `
      SELECT id, slug, title, content, summary, state, locale, created_at, updated_at, views
      FROM posts
      ORDER BY created_at DESC
    `;

    const result = await this.db.prepare(query).all<Post>();
    return result.results;
  }
}
