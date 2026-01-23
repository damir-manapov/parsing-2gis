#!/usr/bin/env bun
/**
 * Export reviews as a simple dataset (text + rating)
 * Usage: bun scripts/export-reviews-dataset.ts [--format jsonl|csv] [--output path]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from '../src/utils.js';

interface Review {
  text: string;
  rating: number;
  date?: string | null;
  author?: string;
}

interface ReviewFile {
  metadata: {
    query?: string;
    orgId?: string;
    timestamp: string;
  };
  data: Review[];
}

const args = parseArgs(process.argv.slice(2), {
  format: 'jsonl',
  output: 'data/exports',
});
const format = args.format as 'jsonl' | 'csv';

if (!['jsonl', 'csv'].includes(format)) {
  console.error('❌ Invalid format. Use: jsonl or csv');
  process.exit(1);
}

const reviewsDir = 'data/parsed/full-with-reviews/reviews';

if (!existsSync(reviewsDir)) {
  console.error('❌ No reviews directory found. Please scrape some data first.');
  process.exit(1);
}

console.log('📚 Collecting reviews...\n');

const allReviews: Array<{ text: string; rating: number }> = [];
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

console.log(`✅ Collected ${allReviews.length} reviews with text and rating\n`);

// Export based on format
const outputDir = args.output;
const extension = format === 'jsonl' ? 'jsonl' : 'csv';
const outputPath = join(outputDir, `reviews-dataset.${extension}`);

if (format === 'jsonl') {
  const jsonlContent = allReviews.map((r) => JSON.stringify(r)).join('\n');
  writeFileSync(outputPath, jsonlContent, 'utf-8');
  console.log(`📝 Exported to: ${outputPath}`);
  console.log(`   Format: JSONL (one JSON object per line)`);
} else {
  const header = 'rating,text\n';
  const rows = allReviews
    .map((r) => {
      // Escape quotes and wrap text in quotes
      const escapedText = r.text.replace(/"/g, '""');
      return `${r.rating},"${escapedText}"`;
    })
    .join('\n');
  writeFileSync(outputPath, header + rows, 'utf-8');
  console.log(`📝 Exported to: ${outputPath}`);
  console.log(`   Format: CSV (rating,text)`);
}

// Show sample
console.log('\n📊 Sample reviews:');
for (let i = 0; i < Math.min(3, allReviews.length); i++) {
  const review = allReviews[i];
  if (!review) continue;
  const preview = review.text.substring(0, 60) + (review.text.length > 60 ? '...' : '');
  console.log(`   [${review.rating}⭐] ${preview}`);
}
