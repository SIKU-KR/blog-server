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
  createdAt: string;
  updatedAt: string;
}

interface PostUpdateData {
  title: string;
  content: string;
  summary: string | null;
  state: string;
  slug: string | null;
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

  async findBySlugExcludingId(
    slug: string,
    id: number
  ): Promise<{ id: number } | null> {
    return await this.db
      .prepare(postQueries.selectBySlugExcludingId)
      .bind(slug, id)
      .first<{ id: number }>();
  }

  async create(postData: PostCreateData): Promise<number> {
    const { slug, title, content, summary, state, createdAt, updatedAt } =
      postData;

    const result = await this.db
      .prepare(postQueries.insert)
      .bind(slug, title, content, summary, state, createdAt, updatedAt)
      .run();

    return result.meta.last_row_id as number;
  }

  async update(id: number, postData: PostUpdateData): Promise<void> {
    const { title, content, summary, state, slug, updatedAt } = postData;

    await this.db
      .prepare(postQueries.update)
      .bind(title, content, summary, state, slug, updatedAt, id)
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

  async findPublishedById(id: number): Promise<Post | null> {
    return await this.db
      .prepare(postQueries.selectPublishedById)
      .bind(id)
      .first<Post>();
  }

  async findAll(options: {
    tag?: string | null;
    offset?: number;
    limit?: number;
    orderClause?: string;
  }): Promise<Post[]> {
    const { tag = null, offset = 0, limit = 10, orderClause = "created_at DESC" } = options;

    let query: string;
    let bindings: (string | number)[];

    if (tag) {
      query = `
        SELECT p.id, p.slug, p.title, p.summary, p.created_at, p.updated_at, p.views
        FROM posts p
        WHERE p.state = 'published'
          AND p.id IN (
            SELECT DISTINCT pt.post_id
            FROM post_tags pt
            INNER JOIN tags t ON pt.tag_id = t.id
            WHERE t.name = ?
          )
        ORDER BY ${orderClause}
        LIMIT ? OFFSET ?
      `;
      bindings = [tag, limit, offset];
    } else {
      query = `
        SELECT id, slug, title, summary, created_at, updated_at, views
        FROM posts
        WHERE state = 'published'
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

  async count(tag: string | null = null): Promise<number> {
    let query: string;
    let bindings: string[];

    if (tag) {
      query = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM posts p
        INNER JOIN post_tags pt ON p.id = pt.post_id
        INNER JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ? AND p.state = 'published'
      `;
      bindings = [tag];
    } else {
      query = `
        SELECT COUNT(*) as total
        FROM posts
        WHERE state = 'published'
      `;
      bindings = [];
    }

    const result = await this.db
      .prepare(query)
      .bind(...bindings)
      .first<{ total: number }>();

    return result?.total ?? 0;
  }

  async incrementViews(id: number): Promise<void> {
    await this.db.prepare(postQueries.incrementViews).bind(id).run();
  }

  async getViews(id: number): Promise<number | null> {
    const result = await this.db
      .prepare(postQueries.selectViews)
      .bind(id)
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
}
