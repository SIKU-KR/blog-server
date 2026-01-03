/**
 * Tag Service
 * Business logic for tag management
 */

import { TagRepository } from "../repositories";

interface TagResponse {
  id: number;
  name: string;
  postCount: number;
  createdAt: string;
}

export class TagService {
  private repository: TagRepository;

  constructor(db: D1Database) {
    this.repository = new TagRepository(db);
  }

  async getActiveTags(locale?: string): Promise<TagResponse[]> {
    const tags = await this.repository.findAllActive(locale);

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      postCount: tag.post_count,
      createdAt: tag.created_at,
    }));
  }
}
