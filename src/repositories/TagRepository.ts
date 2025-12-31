/**
 * Tag Repository
 * Data access layer for tags
 */

import { tagQueries } from "../sql";
import type { Tag } from "../types";

export class TagRepository {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async findAllActive(): Promise<Tag[]> {
    const result = await this.db.prepare(tagQueries.selectAllActive).all<Tag>();
    return result.results;
  }

  async findAllPublishedSlugs(): Promise<string[]> {
    const result = await this.db
      .prepare(tagQueries.selectAllPublishedSlugs)
      .all<{ slug: string }>();

    return result.results.map((post) => post.slug);
  }
}
