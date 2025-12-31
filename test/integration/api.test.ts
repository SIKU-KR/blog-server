/**
 * API Integration Tests
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { env, SELF } from "cloudflare:test";
import { setupDatabase, cleanDatabase, createTestPost, createTestComment, createTestTag, associatePostTag } from "../setup";
import { generateJWT, createPayload, hashPassword } from "../../src/auth/jwt";

describe("Blog Server API", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("Health Check", () => {
    it("GET /health should return ok status", async () => {
      const response = await SELF.fetch("http://localhost/health");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
    });
  });

  describe("Authentication", () => {
    describe("POST /login", () => {
      it("should return token for valid credentials", async () => {
        // Hash password with test salt
        const hashedPassword = await hashPassword("testpassword", env.PASSWORD_SALT);

        // Temporarily override env for this test (assuming env is mutable in tests)
        const originalPassword = env.ADMIN_PASSWORD;
        (env as any).ADMIN_PASSWORD = hashedPassword;

        const response = await SELF.fetch("http://localhost/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: env.ADMIN_USERNAME,
            password: "testpassword",
          }),
        });

        (env as any).ADMIN_PASSWORD = originalPassword;

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.token).toBeDefined();
        expect(data.expiresIn).toBe(7200);
      });

      it("should return 401 for invalid credentials", async () => {
        const response = await SELF.fetch("http://localhost/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "wrong",
            password: "wrong",
          }),
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe("Invalid credentials");
      });

      it("should return 400 for missing fields", async () => {
        const response = await SELF.fetch("http://localhost/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "admin" }),
        });

        expect(response.status).toBe(400);
      });
    });

    describe("GET /session", () => {
      it("should validate valid token", async () => {
        const payload = createPayload(1, 3600);
        const token = await generateJWT(payload, env.JWT_SECRET);

        const response = await SELF.fetch("http://localhost/session", {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.valid).toBe(true);
        expect(data.userId).toBe(1);
      });

      it("should return 401 without token", async () => {
        const response = await SELF.fetch("http://localhost/session");

        expect(response.status).toBe(401);
      });
    });
  });

  describe("Public Posts API", () => {
    describe("GET /posts", () => {
      it("should return paginated posts", async () => {
        await createTestPost({ title: "Post 1" });
        await createTestPost({ title: "Post 2" });

        const response = await SELF.fetch("http://localhost/posts");

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.content).toHaveLength(2);
        expect(data.data.totalElements).toBe(2);
      });

      it("should filter by tag", async () => {
        const post1 = await createTestPost({ title: "JavaScript Post" });
        const post2 = await createTestPost({ title: "Python Post" });
        const jsTag = await createTestTag("javascript");
        await associatePostTag(post1.id, jsTag.id);

        const response = await SELF.fetch("http://localhost/posts?tag=javascript");

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.content).toHaveLength(1);
        expect(data.data.content[0].title).toBe("JavaScript Post");
      });

      it("should handle pagination", async () => {
        for (let i = 0; i < 15; i++) {
          await createTestPost({ title: `Post ${i}` });
        }

        const response = await SELF.fetch("http://localhost/posts?page=1&size=5");

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.content).toHaveLength(5);
        expect(data.data.pageNumber).toBe(1);
        expect(data.data.pageSize).toBe(5);
        expect(data.data.totalElements).toBe(15);
      });
    });

    describe("GET /posts/:slug", () => {
      it("should return post by slug", async () => {
        await createTestPost({ slug: "my-test-post", title: "My Test Post" });

        const response = await SELF.fetch("http://localhost/posts/my-test-post");

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.title).toBe("My Test Post");
      });

      it("should redirect numeric ID to slug", async () => {
        const post = await createTestPost({ slug: "redirect-test" });

        const response = await SELF.fetch(`http://localhost/posts/${post.id}`, {
          redirect: "manual",
        });

        expect(response.status).toBe(301);
        expect(response.headers.get("Location")).toContain("/posts/redirect-test");
      });

      it("should return 404 for non-existent post", async () => {
        const response = await SELF.fetch("http://localhost/posts/non-existent");

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.success).toBe(false);
      });
    });

    describe("PATCH /posts/:postId/views", () => {
      it("should increment view count", async () => {
        const post = await createTestPost();

        const response = await SELF.fetch(
          `http://localhost/posts/${post.id}/views`,
          { method: "PATCH" }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.data.views).toBe(1);

        // Increment again
        const response2 = await SELF.fetch(
          `http://localhost/posts/${post.id}/views`,
          { method: "PATCH" }
        );
        const data2 = await response2.json();
        expect(data2.data.views).toBe(2);
      });
    });
  });

  describe("Public Comments API", () => {
    describe("GET /comments/:postId", () => {
      it("should return comments for post", async () => {
        const post = await createTestPost();
        await createTestComment(post.id, { content: "Comment 1", author: "Author 1" });
        await createTestComment(post.id, { content: "Comment 2", author: "Author 2" });

        const response = await SELF.fetch(`http://localhost/comments/${post.id}`);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
      });

      it("should return 404 for non-existent post", async () => {
        const response = await SELF.fetch("http://localhost/comments/99999");

        expect(response.status).toBe(404);
      });
    });

    describe("POST /comments/:postId", () => {
      it("should create comment", async () => {
        const post = await createTestPost();

        const response = await SELF.fetch(`http://localhost/comments/${post.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "New comment",
            author: "New Author",
          }),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.content).toBe("New comment");
        expect(data.data.authorName).toBe("New Author");
      });

      it("should validate comment data", async () => {
        const post = await createTestPost();

        const response = await SELF.fetch(`http://localhost/comments/${post.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "", // Too short
            author: "A", // Too short
          }),
        });

        expect(response.status).toBe(400);
      });
    });
  });

  describe("Public Tags API", () => {
    describe("GET /tags", () => {
      it("should return active tags", async () => {
        const post = await createTestPost();
        const tag = await createTestTag("test-tag");
        await associatePostTag(post.id, tag.id);

        const response = await SELF.fetch("http://localhost/tags");

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Public Sitemap API", () => {
    describe("GET /sitemap", () => {
      it("should return published post slugs", async () => {
        await createTestPost({ slug: "post-1" });
        await createTestPost({ slug: "post-2" });
        await createTestPost({ slug: "draft-post", state: "draft" });

        const response = await SELF.fetch("http://localhost/sitemap");

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toContain("post-1");
        expect(data.data).toContain("post-2");
        expect(data.data).not.toContain("draft-post");
      });
    });
  });

  describe("Admin API", () => {
    let authToken: string;

    beforeEach(async () => {
      const payload = createPayload(1, 3600);
      authToken = await generateJWT(payload, env.JWT_SECRET);
    });

    describe("POST /admin/posts", () => {
      it("should create post with valid token", async () => {
        const response = await SELF.fetch("http://localhost/admin/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            title: "New Post",
            content: "Content here",
            summary: "Summary here",
            state: "published",
            tags: ["test"],
          }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.title).toBe("New Post");
        expect(data.slug).toBe("new-post");
      });

      it("should return 401 without token", async () => {
        const response = await SELF.fetch("http://localhost/admin/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New Post",
            content: "Content",
            summary: "Summary",
            state: "published",
          }),
        });

        expect(response.status).toBe(401);
      });
    });

    describe("PUT /admin/posts/:postId", () => {
      it("should update post", async () => {
        const post = await createTestPost();

        const response = await SELF.fetch(
          `http://localhost/admin/posts/${post.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              title: "Updated Title",
              content: "Updated content",
              summary: "Updated summary",
              state: "published",
            }),
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.title).toBe("Updated Title");
      });

      it("should return 404 for non-existent post", async () => {
        const response = await SELF.fetch(
          "http://localhost/admin/posts/99999",
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              title: "Updated",
              content: "Content",
              summary: "Summary",
              state: "published",
            }),
          }
        );

        expect(response.status).toBe(404);
      });
    });

    describe("DELETE /admin/posts/:postId", () => {
      it("should delete post", async () => {
        const post = await createTestPost();

        const response = await SELF.fetch(
          `http://localhost/admin/posts/${post.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.deleted).toBe(true);
      });
    });

    describe("DELETE /admin/comments/:commentId", () => {
      it("should delete comment", async () => {
        const post = await createTestPost();
        const comment = await createTestComment(post.id);

        const response = await SELF.fetch(
          `http://localhost/admin/comments/${comment.id}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.deleted).toBe(true);
      });

      it("should return 404 for non-existent comment", async () => {
        const response = await SELF.fetch(
          "http://localhost/admin/comments/00000000-0000-0000-0000-000000000000",
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe("404 Handler", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await SELF.fetch("http://localhost/unknown/route");

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(404);
    });
  });
});
