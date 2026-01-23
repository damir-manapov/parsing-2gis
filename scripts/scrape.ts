// Run with: bun scripts/scrape.ts [--query "кальян"] [--delay 2000] [--max-records 50] [--mode full] [--headless true]
// Modes: list (basic data only), full (detailed data), full-with-reviews (detailed data + reviews)
// Uses Playwright to scrape 2GIS search results and detail pages

import { scrapeSearchResults } from '../src/scraper/index.js';
import type { ScraperOptions } from '../src/types/index.js';
import {
  createFileTimestamp,
  createMetadata,
  Logger,
  parseArgs,
  saveParsedData,
  saveRawData,
  slugify,
} from '../src/utils.js';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: CLI entry point handles all argument parsing and orchestration
async function main() {
  const args = parseArgs(process.argv.slice(2), {
    query: 'кальян',
    delay: '2000',
    'max-records': '50',
    'max-retries': '3',
    headless: 'true',
    mode: 'full',
    'max-reviews': '100',
  });

  const options: ScraperOptions = {
    query: args.query,
    delayMs: Number(args.delay),
    maxRecords: Number(args['max-records']),
    maxRetries: Number(args['max-retries']),
    headless: args.headless === 'true',
    scrapingMode: args.mode as 'list' | 'full' | 'full-with-reviews',
    maxReviewsPerOrg: Number(args['max-reviews']),
  };

  // Validate mode
  if (!['list', 'full', 'full-with-reviews'].includes(options.scrapingMode)) {
    console.error(
      `Invalid mode "${options.scrapingMode}". Must be one of: list, full, full-with-reviews`,
    );
    process.exit(1);
  }

  const logger = new Logger();
  logger.info(`Scraping 2GIS for "${options.query}" in Moscow`);
  logger.info(
    `Configuration: delay=${options.delayMs}ms, maxRecords=${options.maxRecords}, retries=${options.maxRetries}, mode=${options.scrapingMode}${options.scrapingMode === 'full-with-reviews' ? `, reviews=${options.maxReviewsPerOrg}` : ''}`,
  );

  const startTime = Date.now();
  const { organizations, rawData } = await scrapeSearchResults(options);
  const responseTime = Date.now() - startTime;

  logger.info(`Total time: ${(responseTime / 1000).toFixed(1)}s`);
  logger.success(`Scraped ${organizations.length} organizations`);

  // Display summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(80));

  for (const org of organizations) {
    console.log(`\n${org.name}`);
    if (org.description) console.log(`  Description: ${org.description}`);
    console.log(`  Address: ${org.address}`);
    if (org.city || org.district) {
      const location = [org.city, org.district, org.region].filter(Boolean).join(', ');
      console.log(`  Location: ${location}`);
    }
    if (org.postcode) console.log(`  Postcode: ${org.postcode}`);
    console.log(`  Phone: ${org.phone ?? '-'}`);
    if (org.email) console.log(`  Email: ${org.email}`);
    console.log(`  Website: ${org.website ?? '-'}`);
    if (org.schedule) console.log(`  Schedule: ${org.schedule}`);
    console.log(`  Rating: ${org.rating ?? '-'} (${org.reviewCount ?? 0} reviews)`);
    console.log(`  Rubrics: ${org.rubrics.join(', ')}`);
    if (org.type) console.log(`  Type: ${org.type}`);
  }

  // Save results
  const fileTimestamp = createFileTimestamp();
  const metadata = createMetadata({
    apiVersion: 'playwright-scrape',
    endpoint: 'search-scrape',
    statusCode: 200,
    query: options.query,
    totalResults: organizations.length,
    responseTimeMs: responseTime,
  });

  const slug = slugify(options.query);
  const modePrefix = options.scrapingMode;

  console.log('\n============================================================');
  console.log('RESULTS SUMMARY');
  console.log('============================================================\n');

  // Save based on scraping mode
  if (options.scrapingMode === 'list') {
    // List mode: save basic list data
    await saveRawData(`${modePrefix}-raw-${slug}-${fileTimestamp}.json`, metadata, rawData);
    logger.success(`List raw data saved (${rawData.length} items)`);

    await saveParsedData(`${modePrefix}-${slug}-${fileTimestamp}.json`, metadata, organizations);
    logger.success(`List parsed data saved (${organizations.length} items)`);
  } else if (options.scrapingMode === 'full') {
    // Full mode: save organization details from main pages
    await saveRawData(
      `${modePrefix}-organizations-raw-${slug}-${fileTimestamp}.json`,
      metadata,
      rawData,
    );
    logger.success(`Organizations raw data saved (${rawData.length} items)`);

    await saveParsedData(
      `${modePrefix}-organizations-${slug}-${fileTimestamp}.json`,
      metadata,
      organizations,
    );
    logger.success(`Organizations parsed data saved (${organizations.length} items)`);
  } else if (options.scrapingMode === 'full-with-reviews') {
    // Full-with-reviews mode: save organizations and reviews separately
    await saveRawData(
      `${modePrefix}-organizations-raw-${slug}-${fileTimestamp}.json`,
      metadata,
      rawData,
    );
    logger.success(`Organizations raw data saved (${rawData.length} items)`);

    await saveParsedData(
      `${modePrefix}-organizations-${slug}-${fileTimestamp}.json`,
      metadata,
      organizations,
    );
    logger.success(`Organizations parsed data saved (${organizations.length} items)`);

    // Extract and save reviews separately
    const allReviews = organizations.flatMap((org) => {
      if (!org.reviews || org.reviews.length === 0) return [];
      return org.reviews.map((review) => ({
        ...review,
        organizationId: org.orgId,
        organizationName: org.name,
      }));
    });

    if (allReviews.length > 0) {
      await saveParsedData(
        `${modePrefix}-reviews-${slug}-${fileTimestamp}.json`,
        { ...metadata, totalResults: allReviews.length },
        allReviews,
      );
      logger.success(`Reviews data saved (${allReviews.length} reviews)`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  logger.success('Scraping completed successfully!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
