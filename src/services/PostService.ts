/**
 * Post Service
 * Business logic for post management
 */

import { PostRepository } from "../repositories";
import { ValidationError, NotFoundError } from "../utils/errors";
import {
  validatePostRequest,
  validatePagination,
  validateSorting,
} from "../utils/validation";
import type { Logger, PostWithTags, PostListItem, PaginatedResponse } from "../types";

export class PostService {
  private repository: PostRepository;

  constructor(db: D1Database) {
    this.repository = new PostRepository(db);
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async createPost(
    postData: Record<string, unknown>,
    logger?: Logger
  ): Promise<PostWithTags> {
    validatePostRequest(postData);

    const {
      title,
      content,
      summary,
      tags = [],
      state,
    } = postData as {
      title: string;
      content: string;
      summary: string;
      tags?: string[];
      state: string;
    };
    let slug = postData.slug as string | undefined;

    if (!slug) {
      slug = this.generateSlug(title);
    }

    const existingPost = await this.repository.findBySlug(slug);
    if (existingPost) {
      throw new ValidationError("Slug already exists");
    }

    const now = new Date().toISOString();
    const postId = await this.repository.create({
      slug,
      title,
      content,
      summary,
      state,
      createdAt: now,
      updatedAt: now,
    });

    if ((tags as string[]).length > 0) {
      await this.associateTags(postId, tags as string[], now);
    }

    const createdPost = await this.getPostWithTags(postId);

    if (logger) {
      logger.info("Post created", { postId, slug });
    }

    return createdPost!;
  }

  async updatePost(
    postId: number,
    postData: Record<string, unknown>,
    logger?: Logger
  ): Promise<PostWithTags> {
    validatePostRequest(postData);

    const existingPost = await this.repository.findById(postId);
    if (!existingPost) {
      throw new NotFoundError("Post not found");
    }

    const { title, content, summary, tags = [], state, slug } = postData as {
      title: string;
      content: string;
      summary: string;
      tags?: string[];
      state: string;
      slug?: string;
    };

    if (slug) {
      const slugConflict = await this.repository.findBySlugExcludingId(
        slug,
        postId
      );
      if (slugConflict) {
        throw new ValidationError("Slug already exists");
      }
    }

    const now = new Date().toISOString();
    await this.repository.update(postId, {
      title,
      content,
      summary,
      state,
      slug: slug || null,
      updatedAt: now,
    });

    await this.repository.deletePostTags(postId);

    if ((tags as string[]).length > 0) {
      await this.associateTags(postId, tags as string[], now);
    }

    const updatedPost = await this.getPostWithTags(postId);

    if (logger) {
      logger.info("Post updated", { postId });
    }

    return updatedPost!;
  }

  async deletePost(
    postId: number,
    logger?: Logger
  ): Promise<{ deleted: boolean; id: number }> {
    const existingPost = await this.repository.findById(postId);
    if (!existingPost) {
      throw new NotFoundError("Post not found");
    }

    await this.repository.delete(postId);

    if (logger) {
      logger.info("Post deleted", { postId });
    }

    return { deleted: true, id: postId };
  }

  private async associateTags(
    postId: number,
    tags: string[],
    timestamp: string
  ): Promise<void> {
    for (const tagName of tags) {
      const tag = await this.repository.findTagByName(tagName);

      let tagId: number;
      if (!tag) {
        tagId = await this.repository.createTag(tagName, timestamp);
      } else {
        tagId = tag.id;
      }

      await this.repository.createPostTag(postId, tagId);
    }
  }

  private async getPostWithTags(postId: number): Promise<PostWithTags | null> {
    const post = await this.repository.findById(postId);
    if (!post) {
      return null;
    }

    const tags = await this.repository.getTagsByPostId(postId);

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      summary: post.summary,
      tags,
      state: post.state,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      views: post.views,
    };
  }

  // Public API methods
  async getPosts(options: {
    tag?: string | null;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<PaginatedResponse<PostListItem>> {
    const { tag = null, page = 0, size = 10, sort = "createdAt,desc" } = options;

    const paginationErrors = validatePagination({ page, size });
    if (paginationErrors.length > 0) {
      throw new ValidationError(paginationErrors.join(", "));
    }

    const allowedSortFields = ["createdAt", "updatedAt", "views", "title"];
    const sortErrors = validateSorting(sort, allowedSortFields);
    if (sortErrors.length > 0) {
      throw new ValidationError(sortErrors.join(", "));
    }

    const [sortField, sortDirection] = sort.split(",");

    const fieldMapping: Record<string, string> = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      views: "views",
      title: "title",
    };

    const dbSortField = fieldMapping[sortField] || sortField;
    const orderClause = `${dbSortField} ${sortDirection.toUpperCase()}`;

    const offset = page * size;

    const [posts, totalElements] = await Promise.all([
      this.repository.findAll({ tag, offset, limit: size, orderClause }),
      this.repository.count(tag),
    ]);

    const postIds = posts.map((p) => p.id);
    const tagsByPost = await this.repository.getTagsForPosts(postIds);

    const postsWithTags: PostListItem[] = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: tagsByPost.get(post.id) || [],
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      views: post.views,
    }));

    return {
      content: postsWithTags,
      totalElements,
      pageNumber: page,
      pageSize: size,
    };
  }

  async getPostBySlug(
    slug: string
  ): Promise<
    { redirect: true; slug: string } | { redirect: false; data: PostWithTags }
  > {
    if (!slug) {
      throw new ValidationError("Slug parameter is required");
    }

    const isNumericId = /^\d+$/.test(slug);

    if (isNumericId) {
      const post = await this.repository.findPublishedById(parseInt(slug, 10));

      if (!post) {
        throw new NotFoundError("Post not found");
      }

      return {
        redirect: true,
        slug: post.slug,
      };
    }

    const post = await this.repository.findPublishedBySlug(slug);

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    const tags = await this.repository.getTagsForPost(post.id);

    return {
      redirect: false,
      data: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        content: post.content,
        summary: post.summary,
        tags,
        state: post.state,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        views: post.views,
      },
    };
  }

  async incrementPostViews(postId: string | number): Promise<{ views: number }> {
    if (!postId) {
      throw new ValidationError("Post ID is required");
    }

    const id = typeof postId === "number" ? postId : parseInt(postId, 10);
    if (isNaN(id)) {
      throw new ValidationError("Invalid post ID");
    }

    await this.repository.incrementViews(id);

    const views = await this.repository.getViews(id);

    if (views === null) {
      throw new NotFoundError("Post not found");
    }

    return { views };
  }
}
