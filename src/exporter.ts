/**
 * Dataset exporter for reviews data
 * Exports collected reviews to JSONL or CSV format
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type ExportFormat = 'jsonl' | 'csv';

export interface ReviewDataset {
  text: string;
  rating: number;
}

interface ReviewFile {
  metadata: {
    query?: string;
    orgId?: string;
    timestamp: string;
  };
  data: Array<{
    text: string;
    rating: number;
    date?: string | null;
    author?: string;
  }>;
}

export interface ExportResult {
  reviews: ReviewDataset[];
  outputPath: string;
  format: ExportFormat;
}

const REVIEWS_DIR = 'data/parsed/full-with-reviews/reviews';

/**
 * Collect all reviews from parsed data
 */
export function collectReviews(reviewsDir: string = REVIEWS_DIR): ReviewDataset[] {
  if (!existsSync(reviewsDir)) {
    throw new Error(`Reviews directory not found: ${reviewsDir}`);
  }

  const allReviews: ReviewDataset[] = [];
  const files = readdirSync(reviewsDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const filePath = join(reviewsDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const reviewFile: ReviewFile = JSON.parse(content);

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
export function exportReviews(
  outputDir: string,
  format: ExportFormat,
  reviewsDir: string = REVIEWS_DIR,
): ExportResult {
  const reviews = collectReviews(reviewsDir);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const extension = format === 'jsonl' ? 'jsonl' : 'csv';
  const outputPath = join(outputDir, `reviews-dataset.${extension}`);

  const content = format === 'jsonl' ? exportToJSONL(reviews) : exportToCSV(reviews);

  writeFileSync(outputPath, content, 'utf-8');

  return {
    reviews,
    outputPath,
    format,
  };
}
