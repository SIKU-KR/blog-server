/**
 * Comment Service
 * Business logic for comment management
 */

import { CommentRepository } from "../repositories";
import { ValidationError, NotFoundError } from "../utils/errors";
import { validateCreateComment } from "../utils/validation";
import type { Logger } from "../types";

interface CommentResponse {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
  postId: number;
}

export class CommentService {
  private repository: CommentRepository;

  constructor(db: D1Database) {
    this.repository = new CommentRepository(db);
  }

  // Admin: Delete comment
  async deleteComment(
    commentId: string,
    logger?: Logger
  ): Promise<{ deleted: boolean; id: string }> {
    if (!commentId || commentId.length < 36) {
      throw new ValidationError("Invalid comment ID format");
    }

    const existingComment = await this.repository.findById(commentId);
    if (!existingComment) {
      throw new NotFoundError("Comment not found");
    }

    await this.repository.delete(commentId);

    if (logger) {
      logger.info("Comment deleted", { commentId });
    }

    return { deleted: true, id: commentId };
  }

  // Public: Get comments for a post (unified across translations)
  async getCommentsByPostId(postId: string | number): Promise<CommentResponse[]> {
    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = typeof postId === "number" ? postId : parseInt(postId as string, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    const postExists = await this.repository.postExists(id);
    if (!postExists) {
      throw new NotFoundError("Post not found");
    }

    // Get original post ID for unified comments
    const originalId = await this.repository.getOriginalPostId(id);
    if (!originalId) {
      throw new NotFoundError("Post not found");
    }

    // Fetch comments from the original post
    const comments = await this.repository.findByPostId(originalId);

    return comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      authorName: comment.author_name,
      createdAt: comment.created_at,
      postId: comment.post_id,
    }));
  }

  // Public: Create comment (always on original post for unified comments)
  async createComment(
    postId: string | number,
    commentData: { content?: string; author?: string }
  ): Promise<CommentResponse> {
    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = typeof postId === "number" ? postId : parseInt(postId as string, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    const postExists = await this.repository.postExists(id);
    if (!postExists) {
      throw new NotFoundError("Post not found");
    }

    // Get original post ID to store comment there
    const originalId = await this.repository.getOriginalPostId(id);
    if (!originalId) {
      throw new NotFoundError("Post not found");
    }

    const errors = validateCreateComment(commentData);
    if (errors.length > 0) {
      throw new ValidationError(errors.join(", "));
    }

    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.repository.create({
      id: commentId,
      content: commentData.content!,
      authorName: commentData.author!,
      createdAt: now,
      postId: originalId, // Always store on original post
    });

    return {
      id: commentId,
      content: commentData.content!,
      authorName: commentData.author!,
      createdAt: now,
      postId: originalId,
    };
  }
}
