// Two-stage scraping workflow:
// Stage 1: bun scripts/scrape.ts --query "кальян" --mode list
// Stage 2: bun scripts/scrape.ts --from-list data/parsed/list/list---2026-01-23T14-02-43-026Z.json --mode full
//
// Or single org: bun scripts/scrape.ts --org-id 70000001044609041 --mode full
// Modes: list (basic data only), full (detailed data), full-with-reviews (detailed data + reviews)

import { DEFAULT_DELAYS, DEFAULT_LIMITS } from '../src/config.js';
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

function validateOptions(options: ScraperOptions): void {
  // Validate that either query, orgId, or fromList is provided
  if (!options.query && !options.orgId && !options.fromList) {
    console.error('Either --query, --org-id, or --from-list must be provided');
    process.exit(1);
  }

  // Validate mode
  if (!['list', 'full', 'full-with-reviews'].includes(options.scrapingMode)) {
    console.error(
      `Invalid mode "${options.scrapingMode}". Must be one of: list, full, full-with-reviews`,
    );
    process.exit(1);
  }

  // List mode requires query (not orgId or fromList)
  if (options.scrapingMode === 'list' && (options.orgId || options.fromList)) {
    console.error('List mode requires --query, not --org-id or --from-list');
    process.exit(1);
  }

  // fromList requires full or full-with-reviews mode
  if (options.fromList && options.scrapingMode === 'list') {
    console.error('--from-list requires --mode full or full-with-reviews');
    process.exit(1);
  }
}

async function getQueryForSaving(
  repository: ScraperRepository,
  options: ScraperOptions,
): Promise<string> {
  if (options.fromList) {
    const listData = await repository.readListFile(options.fromList);
    return listData.query || 'from-list';
  }
  return options.query || 'unknown';
}

async function saveResults(
  repository: ScraperRepository,
  options: ScraperOptions,
  responseTime: number,
  organizations: ScrapedOrganization[],
  // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
  rawData: any[],
): Promise<void> {
  if (options.orgId) {
    // Save single organization by ID
    const org = organizations[0];
    const raw = rawData[0];
    if (org && raw) {
      await repository.saveOrganizationById(
        options.orgId,
        responseTime,
        org,
        raw,
        options.scrapingMode === 'full-with-reviews',
      );
    }
  } else {
    const query = await getQueryForSaving(repository, options);
    if (options.scrapingMode === 'list') {
      await repository.saveListData(query, responseTime, organizations, rawData);
    } else if (options.scrapingMode === 'full') {
      await repository.saveOrganizations(query, responseTime, organizations, rawData, 'full');
    } else if (options.scrapingMode === 'full-with-reviews') {
      await repository.saveOrganizations(
        query,
        responseTime,
        organizations,
        rawData,
        'full-with-reviews',
      );
      await repository.saveReviews(query, responseTime, organizations);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    query: 'кальян',
    'org-id': '',
    'from-list': '',
    delay: String(DEFAULT_DELAYS.betweenRequests),
    'max-records': String(DEFAULT_LIMITS.maxRecords),
    'max-retries': String(DEFAULT_LIMITS.maxRetries),
    headless: 'true',
    mode: 'full',
    'max-reviews': String(DEFAULT_LIMITS.maxReviewsPerOrg),
  });

  const options: ScraperOptions = {
    ...(args['from-list']
      ? { fromList: args['from-list'] }
      : args['org-id']
        ? { orgId: args['org-id'] }
        : { query: args.query }),
    delayMs: Number(args.delay),
    maxRecords: Number(args['max-records']),
    maxRetries: Number(args['max-retries']),
    headless: args.headless === 'true',
    scrapingMode: args.mode as 'list' | 'full' | 'full-with-reviews',
    maxReviewsPerOrg: Number(args['max-reviews']),
  };

  validateOptions(options);

  const logger = new Logger();
  if (options.fromList) {
    logger.info(`Scraping from list file: ${options.fromList}`);
  } else if (options.orgId) {
    logger.info(`Scraping 2GIS organization ID: ${options.orgId}`);
  } else {
    logger.info(`Scraping 2GIS for "${options.query}" in Moscow`);
  }
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
  await saveResults(repository, options, responseTime, organizations, rawData);

  console.log(`\n${'='.repeat(80)}`);
  logger.success('Scraping completed successfully!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
