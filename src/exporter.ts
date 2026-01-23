/**
 * Dataset exporter for reviews data
 * Exports collected reviews to JSONL or CSV format
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PublisherRepository, type ReviewDataset } from './repos/index.js';

export type ExportFormat = 'jsonl' | 'csv';

export type { ReviewDataset };

export interface ExportResult {
  reviews: ReviewDataset[];
  outputPath: string;
  format: ExportFormat;
}

/**
 * Collect all reviews from parsed data using repository
 */
export async function collectReviews(reviewsDir?: string): Promise<ReviewDataset[]> {
  const repository = new PublisherRepository();
  return repository.collectReviews(reviewsDir);
}

/**
 * Export reviews to JSONL format
 */
export function exportToJSONL(reviews: ReviewDataset[]): string {
  return reviews.map((r) => JSON.stringify(r)).join('\n');
}

/**
 * Export reviews to CSV format
 */
export function exportToCSV(reviews: ReviewDataset[]): string {
  const header = 'rating,text\n';
  const rows = reviews
    .map((r) => {
      const escapedText = r.text.replace(/"/g, '""');
      return `${r.rating},"${escapedText}"`;
    })
    .join('\n');
  return header + rows;
}

/**
 * Export reviews dataset to file
 */
export async function exportReviews(
  outputDir: string,
  format: ExportFormat,
  reviewsDir?: string,
): Promise<ExportResult> {
  const reviews = await collectReviews(reviewsDir);

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  const extension = format === 'jsonl' ? 'jsonl' : 'csv';
  const outputPath = join(outputDir, `reviews-dataset.${extension}`);

  const content = format === 'jsonl' ? exportToJSONL(reviews) : exportToCSV(reviews);

  await writeFile(outputPath, content, 'utf-8');

  return {
    reviews,
    outputPath,
    format,
  };
}
