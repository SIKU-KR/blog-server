/**
 * AI Generation Service
 * Handles AI-powered text generation using OpenAI Responses API with Structured Outputs
 */

import type { Logger } from "../types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o-2024-08-06";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Structured Output Schemas
const SUMMARY_SCHEMA = {
  type: "json_schema" as const,
  name: "summary_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "A concise summary of the blog post content",
      },
    },
    required: ["summary"],
    additionalProperties: false,
  },
};

const SLUG_SCHEMA = {
  type: "json_schema" as const,
  name: "slug_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "A URL-friendly slug for the blog post",
      },
    },
    required: ["slug"],
    additionalProperties: false,
  },
};

export interface SummaryResponse {
  summary: string;
}

export interface SlugResponse {
  slug: string;
}

interface OpenAIResponsesAPIResponse {
  id: string;
  object: string;
  created_at: number;
  model: string;
  output: Array<{
    type: string;
    id: string;
    status: string;
    role: string;
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export class AIGenerationService {
  private openaiApiKey: string;

  constructor(openaiApiKey: string) {
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Generate a summary for blog post content
   */
  async generateSummary(text: string, logger?: Logger): Promise<SummaryResponse> {
    const input = [
      {
        role: "system",
        content: `You are a professional blog editor. Generate a concise, engaging summary for the given blog post content.
The summary should:
- Be 2-3 sentences long (maximum 200 characters)
- Capture the main topic and key points
- Be written in the same language as the original content
- Be engaging and informative for readers`,
      },
      {
        role: "user",
        content: text,
      },
    ];

    const result = await this.callResponsesAPI<SummaryResponse>(
      input,
      SUMMARY_SCHEMA,
      logger
    );

    logger?.info("Summary generated", {
      summaryLength: result.summary.length,
    });

    return result;
  }

  /**
   * Generate a URL-friendly slug from title and content
   */
  async generateSlug(
    title: string,
    content: string,
    logger?: Logger
  ): Promise<SlugResponse> {
    const input = [
      {
        role: "system",
        content: `You are a SEO expert. Generate a URL-friendly slug for the given blog post.
The slug should:
- Be in English (transliterate if the title is in another language)
- Use lowercase letters, numbers, and hyphens only
- Be 3-6 words long, separated by hyphens
- Be descriptive and SEO-friendly
- Not include stop words (the, a, an, is, are, etc.) unless necessary for meaning
- Maximum 60 characters`,
      },
      {
        role: "user",
        content: `Title: ${title}\n\nContent preview: ${content.slice(0, 500)}`,
      },
    ];

    const result = await this.callResponsesAPI<SlugResponse>(
      input,
      SLUG_SCHEMA,
      logger
    );

    // Sanitize the slug to ensure it's valid
    const sanitizedSlug = this.sanitizeSlug(result.slug);

    logger?.info("Slug generated", {
      originalSlug: result.slug,
      sanitizedSlug,
    });

    return { slug: sanitizedSlug };
  }

  /**
   * Call OpenAI Responses API with structured output
   */
  private async callResponsesAPI<T>(
    input: Array<{ role: string; content: string }>,
    format: typeof SUMMARY_SCHEMA | typeof SLUG_SCHEMA,
    logger?: Logger
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(OPENAI_RESPONSES_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            input,
            text: {
              format,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `OpenAI API error: ${response.status} - ${errorBody}`
          );
        }

        const data: OpenAIResponsesAPIResponse = await response.json();

        // Extract the text content from the response
        const outputText = data.output?.[0]?.content?.[0]?.text;

        if (!outputText) {
          throw new Error("Invalid response from OpenAI API: no output text");
        }

        // Parse the JSON response
        const parsed = JSON.parse(outputText) as T;

        logger?.debug("OpenAI Responses API call successful", {
          model: MODEL,
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          totalTokens: data.usage.total_tokens,
        });

        return parsed;
      } catch (error) {
        lastError = error as Error;
        logger?.warn(`OpenAI API attempt ${attempt + 1} failed`, {
          error: lastError.message,
        });

        if (attempt < MAX_RETRIES - 1) {
          await this.delay(RETRY_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error("Failed to call OpenAI API");
  }

  /**
   * Sanitize slug to ensure it's URL-friendly
   */
  private sanitizeSlug(slug: string): string {
    return slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-") // Replace non-alphanumeric chars with hyphens
      .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
      .slice(0, 60); // Limit length
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
