/**
 * Comment Repository
 * Data access layer for comments
 */

import { commentQueries } from "../sql";
import type { Comment } from "../types";

interface CommentCreateData {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  postId: number;
}

export class CommentRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async findById(id: string): Promise<{ id: string } | null> {
    return await this.db
      .prepare(commentQueries.selectById)
      .bind(id)
      .first<{ id: string }>();
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare(commentQueries.delete).bind(id).run();
  }

  async findByPostId(postId: number): Promise<Comment[]> {
    const result = await this.db
      .prepare(commentQueries.selectByPostId)
      .bind(postId)
      .all<Comment>();

    return result.results;
  }

  async create(comment: CommentCreateData): Promise<void> {
    const { id, content, authorName, createdAt, postId } = comment;

    await this.db
      .prepare(commentQueries.insert)
      .bind(id, content, authorName, createdAt, postId)
      .run();
  }

  async postExists(postId: number): Promise<boolean> {
    const result = await this.db
      .prepare(commentQueries.checkPostExists)
      .bind(postId)
      .first();

    return result !== null;
  }
}
