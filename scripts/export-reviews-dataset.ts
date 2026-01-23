#!/usr/bin/env bun
/**
 * Export reviews as a simple dataset (text + rating)
 * Usage: bun scripts/export-reviews-dataset.ts [--format jsonl|csv] [--output path]
 */

import { type ExportFormat, exportReviews } from '../src/exporter.js';
import { parseArgs } from '../src/utils.js';

const args = parseArgs(process.argv.slice(2), {
  format: 'jsonl',
  output: 'data/exports',
});

const format = args.format as ExportFormat;

if (!['jsonl', 'csv'].includes(format)) {
  console.error('❌ Invalid format. Use: jsonl or csv');
  process.exit(1);
}

console.log('📚 Collecting reviews...\n');

async function main() {
  const result = await exportReviews(args.output, format);

  console.log(`✅ Collected ${result.reviews.length} reviews with text and rating\n`);
  console.log(`📝 Exported to: ${result.outputPath}`);
  console.log(
    `   Format: ${format === 'jsonl' ? 'JSONL (one JSON object per line)' : 'CSV (rating,text)'}`,
  );

  // Show sample
  console.log('\n📊 Sample reviews:');
  for (let i = 0; i < Math.min(3, result.reviews.length); i++) {
    const review = result.reviews[i];
    if (!review) continue;
    const preview = review.text.substring(0, 60) + (review.text.length > 60 ? '...' : '');
    console.log(`   [${review.rating}⭐] ${preview}`);
  }

  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
