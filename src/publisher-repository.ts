/**
 * Repository for Hugging Face dataset publishing operations
 * Simplified to only support reviews mode
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export interface PublishStats {
  totalRecords: number;
}

export interface PrepareResult {
  jsonlPath: string;
  readmePath: string;
  stats: PublishStats;
}

const REVIEWS_EXPORT_PATH = 'data/exports/reviews-dataset.jsonl';

export class PublisherRepository {
  /**
   * Check if reviews dataset exists
   */
  hasReviewsDataset(): boolean {
    return existsSync(REVIEWS_EXPORT_PATH);
  }

  /**
   * Read reviews JSONL file and return content
   */
  async readReviewsDataset(): Promise<string> {
    if (!this.hasReviewsDataset()) {
      throw new Error(
        `Reviews dataset not found at ${REVIEWS_EXPORT_PATH}. Run: bun scripts/export-reviews-dataset.ts`,
      );
    }
    return await readFile(REVIEWS_EXPORT_PATH, 'utf-8');
  }

  /**
   * Save dataset file
   */
  async saveDatasetFile(filename: string, content: string): Promise<string> {
    await mkdir('data', { recursive: true });
    const filePath = `data/${filename}`;
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
