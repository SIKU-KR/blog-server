-- Migration: Add locale support for i18n
-- Run with: wrangler d1 execute blog --remote --file=migrations/0001_add_locale.sql

-- Add locale column (default 'ko' for existing posts)
ALTER TABLE posts ADD COLUMN locale TEXT NOT NULL DEFAULT 'ko';

-- Add original_post_id for translation linking
ALTER TABLE posts ADD COLUMN original_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_posts_locale ON posts(locale);
CREATE INDEX IF NOT EXISTS idx_posts_original_post_id ON posts(original_post_id);

-- Composite index for common queries (locale + state)
CREATE INDEX IF NOT EXISTS idx_posts_locale_state ON posts(locale, state);
