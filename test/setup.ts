/**
 * Test setup and utilities
 */

import { env } from "cloudflare:test";

// Helper to create test database schema
export async function setupDatabase() {
  const db = env.DB;

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      state TEXT NOT NULL DEFAULT 'draft',
      locale TEXT NOT NULL DEFAULT 'ko',
      original_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      views INTEGER DEFAULT 0,
      UNIQUE(slug, locale)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      post_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (post_id, tag_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      author_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      post_id INTEGER NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );
  `);
}

// Helper to clean database
export async function cleanDatabase() {
  const db = env.DB;
  await db.exec(`
    DELETE FROM post_tags;
    DELETE FROM comments;
    DELETE FROM tags;
    DELETE FROM posts;
  `);
}

// Helper to create a test post
export async function createTestPost(data?: Partial<{
  slug: string;
  title: string;
  content: string;
  summary: string;
  state: string;
  locale: string;
  originalPostId: number;
}>) {
  const db = env.DB;
  const now = new Date().toISOString();

  const post = {
    slug: data?.slug || `test-post-${Date.now()}`,
    title: data?.title || "Test Post",
    content: data?.content || "Test content",
    summary: data?.summary || "Test summary",
    state: data?.state || "published",
    locale: data?.locale || "ko",
    original_post_id: data?.originalPostId || null,
    created_at: now,
    updated_at: now,
  };

  const result = await db
    .prepare(
      `INSERT INTO posts (slug, title, content, summary, state, locale, original_post_id, created_at, updated_at, views)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(
      post.slug,
      post.title,
      post.content,
      post.summary,
      post.state,
      post.locale,
      post.original_post_id,
      post.created_at,
      post.updated_at
    )
    .run();

  return {
    id: result.meta.last_row_id as number,
    ...post,
    views: 0,
  };
}

// Helper to create a test tag
export async function createTestTag(name: string) {
  const db = env.DB;
  const now = new Date().toISOString();

  const result = await db
    .prepare(`INSERT INTO tags (name, created_at, post_count) VALUES (?, ?, 0)`)
    .bind(name, now)
    .run();

  return {
    id: result.meta.last_row_id as number,
    name,
    created_at: now,
    post_count: 0,
  };
}

// Helper to associate post with tag
export async function associatePostTag(postId: number, tagId: number) {
  const db = env.DB;
  await db
    .prepare(`INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)`)
    .bind(postId, tagId)
    .run();

  // Update tag post count
  await db
    .prepare(`UPDATE tags SET post_count = post_count + 1 WHERE id = ?`)
    .bind(tagId)
    .run();
}

// Helper to create a test comment
export async function createTestComment(postId: number, data?: Partial<{
  content: string;
  author: string;
}>) {
  const db = env.DB;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const comment = {
    id,
    content: data?.content || "Test comment",
    author_name: data?.author || "Test Author",
    created_at: now,
    post_id: postId,
  };

  await db
    .prepare(
      `INSERT INTO comments (id, content, author_name, created_at, post_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, comment.content, comment.author_name, comment.created_at, postId)
    .run();

  return comment;
}
