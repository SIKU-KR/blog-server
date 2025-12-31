/**
 * Image Service
 * Business logic for image upload to R2
 */

import { ValidationError } from "../utils/errors";
import type { Logger } from "../types";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export class ImageService {
  private storage: R2Bucket;
  private cdnDomain: string;

  constructor(storage: R2Bucket, cdnDomain: string) {
    this.storage = storage;
    this.cdnDomain = cdnDomain;
  }

  async uploadImage(
    file: File | null,
    logger?: Logger
  ): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new ValidationError("No file provided");
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ValidationError(
        `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();
    const extension = this.getFileExtension(file.type);
    const key = `images/${year}/${month}/${uuid}.${extension}`;

    await this.storage.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    const url = `https://${this.cdnDomain}/${key}`;

    if (logger) {
      logger.info("Image uploaded", {
        key,
        size: file.size,
        type: file.type,
        url,
      });
    }

    return { url, key };
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
    };
    return extensions[mimeType] || "jpg";
  }
}
