/**
 * Repository for Hugging Face dataset publishing operations
 * Simplified to only support reviews mode
 */

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_PATHS, REVIEWS_PATHS } from './constants.js';

export interface PublishStats {
  totalRecords: number;
}

export interface PrepareResult {
  jsonlPath: string;
  readmePath: string;
  stats: PublishStats;
}

export interface ReviewDataset {
  text: string;
  rating: number;
}

export class PublisherRepository {
  /**
   * Collect all reviews from parsed data
   */
  async collectReviews(reviewsDir: string = REVIEWS_PATHS.dir): Promise<ReviewDataset[]> {
    try {
      await access(reviewsDir);
    } catch {
      throw new Error(`Reviews directory not found: ${reviewsDir}`);
    }

    const allReviews: ReviewDataset[] = [];
    const allFiles = await readdir(reviewsDir);
    const files = allFiles.filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const filePath = join(reviewsDir, file);
      const content = await readFile(filePath, 'utf-8');
      const reviewFile = JSON.parse(content);

      for (const review of reviewFile.data) {
        if (review.text && review.rating) {
          allReviews.push({
            text: review.text,
            rating: review.rating,
          });
        }
      }
    }

    return allReviews;
  }

  /**
   * Check if reviews dataset exists
   */
  async hasReviewsDataset(): Promise<boolean> {
    try {
      await access(REVIEWS_PATHS.export);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read reviews JSONL file and return content
   */
  async readReviewsDataset(): Promise<string> {
    const exists = await this.hasReviewsDataset();
    if (!exists) {
      throw new Error(
        `Reviews dataset not found at ${REVIEWS_PATHS.export}. Run: bun scripts/export-reviews-dataset.ts`,
      );
    }
    return await readFile(REVIEWS_PATHS.export, 'utf-8');
  }

  /**
   * Save dataset file
   */
  async saveDatasetFile(filename: string, content: string): Promise<string> {
    await mkdir(DATA_PATHS.exports, { recursive: true });
    const filePath = `${DATA_PATHS.exports}/${filename}`;
    await writeFile(filePath, content);
    return filePath;
  }

  /**
   * Prepare dataset files for upload
   */
  async prepareDataset(generateReadme: (stats: PublishStats) => string): Promise<PrepareResult> {
    const jsonlContent = await this.readReviewsDataset();
    const lines = jsonlContent.split('\n').filter((l) => l.trim());

    const stats: PublishStats = {
      totalRecords: lines.length,
    };

    const jsonlPath = await this.saveDatasetFile('hf-dataset-reviews.jsonl', jsonlContent);
    const readmePath = await this.saveDatasetFile('hf-README.md', generateReadme(stats));

    return { jsonlPath, readmePath, stats };
  }
}
