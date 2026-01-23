// Run with: bun scripts/scrape.ts [--query "кальян"] [--delay 2000] [--max-records 50] [--mode full] [--headless true]
// Modes: list (basic data only), full (detailed data), full-with-reviews (detailed data + reviews)
// Uses Playwright to scrape 2GIS search results and detail pages

import { ScraperRepository } from '../src/repository.js';
import { scrapeSearchResults } from '../src/scraper/index.js';
import type { ScrapedOrganization, ScraperOptions } from '../src/types/index.js';
import { Logger, parseArgs } from '../src/utils.js';

function displayOrganization(org: ScrapedOrganization): void {
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
    displayOrganization(org);
  }

  console.log(`\n${'='.repeat(80)}\n`);

  console.log(`\n${'='.repeat(80)}\n`);

  // Save results using repository
  const repository = new ScraperRepository(logger);

  if (options.scrapingMode === 'list') {
    await repository.saveListData(options.query, responseTime, organizations, rawData);
  } else if (options.scrapingMode === 'full') {
    await repository.saveOrganizations(options.query, responseTime, organizations, rawData, 'full');
  } else if (options.scrapingMode === 'full-with-reviews') {
    await repository.saveOrganizations(
      options.query,
      responseTime,
      organizations,
      rawData,
      'full-with-reviews',
    );
    await repository.saveReviews(options.query, responseTime, organizations);
  }

  console.log(`\n${'='.repeat(80)}`);
  logger.success('Scraping completed successfully!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
