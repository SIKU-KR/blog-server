/**
 * Sitemap Service
 * Business logic for sitemap generation
 */

import { TagRepository } from "../repositories";

export class SitemapService {
  private repository: TagRepository;

  constructor(db: D1Database) {
    this.repository = new TagRepository(db);
  }

  async generateSitemap(): Promise<string[]> {
    return await this.repository.findAllPublishedSlugs();
  }
}
