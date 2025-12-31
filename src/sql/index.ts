/**
 * SQL Queries
 * All database queries used by the application
 */

// Post queries
export const postQueries = {
  selectById: "SELECT * FROM posts WHERE id = ?",
  selectBySlug: "SELECT id FROM posts WHERE slug = ?",
  selectBySlugExcludingId: "SELECT id FROM posts WHERE slug = ? AND id != ?",
  insert: `INSERT INTO posts (slug, title, content, summary, state, created_at, updated_at, views)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
  update: `UPDATE posts
           SET title = ?, content = ?, summary = ?, state = ?, slug = COALESCE(?, slug), updated_at = ?
           WHERE id = ?`,
  delete: "DELETE FROM posts WHERE id = ?",

  // Public queries
  selectPublishedBySlug: `
    SELECT id, slug, title, content, summary, state, created_at, updated_at, views
    FROM posts
    WHERE slug = ? AND state = 'published'
  `,
  selectPublishedById: `
    SELECT id, slug, title, content, summary, state, created_at, updated_at, views
    FROM posts
    WHERE id = ? AND state = 'published'
  `,
  incrementViews: `
    UPDATE posts
    SET views = views + 1
    WHERE id = ? AND state = 'published'
  `,
  selectViews: "SELECT views FROM posts WHERE id = ?",
};

// Post tag queries
export const postTagQueries = {
  selectTagsByPostId: `SELECT t.name
                       FROM tags t
                       JOIN post_tags pt ON pt.tag_id = t.id
                       WHERE pt.post_id = ?`,
  insert: "INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)",
  deleteByPostId: "DELETE FROM post_tags WHERE post_id = ?",
};

// Tag queries
export const tagQueries = {
  selectByName: "SELECT id FROM tags WHERE name = ?",
  insert: "INSERT INTO tags (name, created_at, post_count) VALUES (?, ?, 0)",
  selectAllActive: `
    SELECT id, name, created_at, post_count
    FROM tags
    WHERE post_count > 0
    ORDER BY name ASC
  `,
  selectAllPublishedSlugs: `
    SELECT slug
    FROM posts
    WHERE state = 'published'
    ORDER BY created_at DESC
  `,
};

// Comment queries
export const commentQueries = {
  selectById: "SELECT id FROM comments WHERE id = ?",
  delete: "DELETE FROM comments WHERE id = ?",
  selectByPostId: `
    SELECT id, content, author_name, created_at, post_id
    FROM comments
    WHERE post_id = ?
    ORDER BY created_at ASC
  `,
  insert: `
    INSERT INTO comments (id, content, author_name, created_at, post_id)
    VALUES (?, ?, ?, ?, ?)
  `,
  checkPostExists: `
    SELECT id FROM posts WHERE id = ? AND state = 'published'
  `,
};
