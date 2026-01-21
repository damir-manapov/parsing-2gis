// Run with: bun scripts/scrape-search.ts [--query "кальян"] [--delay 2000] [--max-records 50]
// Uses Playwright to scrape 2GIS search results and detail pages

import type { Page } from 'playwright';
import { chromium } from 'playwright';
import {
  createFileTimestamp,
  createMetadata,
  findContact,
  Logger,
  parseArgs,
  saveParsedData,
  saveRawData,
  sleep,
  slugify,
} from '../src/utils.js';

interface ScrapedOrganization {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  rubrics: string[];
}

interface ScraperOptions {
  query: string;
  delayMs: number;
  maxRecords: number;
  maxRetries: number;
}

interface DataExtractionResult {
  item: any;
  source: 'api' | 'initialState';
}

// Block unnecessary resources to improve performance
async function setupRequestBlocking(page: Page, logger: Logger) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const resourceType = route.request().resourceType();

    // Block images, fonts, media, stylesheets to speed up scraping
    if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
      route.abort();
      return;
    }

    // Block analytics, ads, and tracking
    if (
      url.includes('google-analytics') ||
      url.includes('googletagmanager') ||
      url.includes('yandex.ru/metrika') ||
      url.includes('mc.yandex.ru') ||
      url.includes('doubleclick.net') ||
      url.includes('/ads/') ||
      url.includes('/metrics/')
    ) {
      route.abort();
      return;
    }

    route.continue();
  });
  logger.debug('Request blocking enabled (images, fonts, analytics)');
}

// Retry wrapper for operations that might fail
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  logger: Logger,
  operationName: string,
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (attempt === maxRetries) {
        logger.error(`${operationName} failed after ${maxRetries} attempts: ${errorMsg}`);
        return null;
      }
      logger.warn(`${operationName} attempt ${attempt} failed: ${errorMsg}, retrying...`);
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
  return null;
}

// Extract organization data from 2GIS item
function extractOrganization(item: any): ScrapedOrganization {
  const phone = findContact(item, 'phone');
  const website = findContact(item, 'website');

  return {
    name: item.name ?? '',
    address: item.address_name ?? '',
    ...(phone !== undefined && { phone }),
    ...(website !== undefined && { website }),
    rating: item.reviews?.rating,
    reviewCount: item.reviews?.general_rating_count,
    rubrics: item.rubrics?.map((r: any) => r.name) ?? [],
  };
}

// Extract data from page (API response or initialState)
async function extractDataFromPage(
  page: Page,
  capturedResponses: any[],
  logger: Logger,
): Promise<DataExtractionResult | null> {
  // Try API response first
  if (capturedResponses.length > 0) {
    const apiData = capturedResponses[0];
    const item = apiData.result?.items?.[0];
    if (item) {
      logger.debug('Using API response');
      return { item, source: 'api' };
    }
  }

  // Fallback to initialState
  try {
    const initialState = await page.evaluate(() => (window as any).initialState);
    const profileData = initialState?.data?.entity?.profile;
    if (profileData) {
      const profiles = Object.values(profileData);
      if (profiles.length > 0) {
        const item = (profiles[0] as any)?.data;
        if (item) {
          logger.debug('Using initialState');
          return { item, source: 'initialState' };
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to extract initialState: ${e}`);
  }

  return null;
}

// Scrape a single organization page
async function scrapeSingleOrganization(
  page: Page,
  url: string,
  capturedResponses: any[],
  options: ScraperOptions,
  logger: Logger,
): Promise<{ organization: ScrapedOrganization; rawData: any } | null> {
  // Clear previous responses
  capturedResponses.length = 0;

  // Navigate to firm page
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for data with configurable delay
  await sleep(options.delayMs);

  // Extract data from page
  const extraction = await extractDataFromPage(page, capturedResponses, logger);

  if (!extraction) {
    throw new Error('No data found for this organization');
  }

  const { item, source } = extraction;

  // Build raw data entry
  const rawData = {
    source,
    url,
    data:
      source === 'api'
        ? capturedResponses[0]
        : await page.evaluate(() => (window as any).initialState),
  };

  // Extract organization data
  const organization = extractOrganization(item);

  // Go back to search results
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(500);

  return { organization, rawData };
}

async function scrapeSearchResults(
  options: ScraperOptions,
): Promise<{ organizations: ScrapedOrganization[]; rawData: any[] }> {
  const logger = new Logger();
  logger.info(
    `Starting scraper with options: maxRecords=${options.maxRecords}, delay=${options.delayMs}ms, retries=${options.maxRetries}`,
  );

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Setup request blocking
  await setupRequestBlocking(page, logger);

  const organizations: ScrapedOrganization[] = [];
  const capturedResponses: any[] = [];
  const rawData: any[] = [];

  // Track API calls for debugging
  let apiCallCount = 0;
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('catalog.api.2gis')) {
      apiCallCount++;
      logger.debug(`API call #${apiCallCount}: ${url.substring(0, 80)}...`);
    }
  });

  // Intercept API responses to extract data
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('catalog.api.2gis') && url.includes('/items/byid')) {
      try {
        const json = await response.json();
        capturedResponses.push(json);
        const itemName = json.result?.items?.[0]?.name ?? 'unknown';
        logger.debug(`Captured API response: ${itemName}`);
      } catch (e) {
        logger.warn(`Failed to parse API response: ${e}`);
      }
    }
  });

  try {
    logger.info(`Navigating to 2GIS search for "${options.query}"...`);

    // Navigate to search page with retry
    const searchUrl = `https://2gis.ru/moscow/search/${encodeURIComponent(options.query)}`;

    const navigateSuccess = await withRetry(
      async () => {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        return true;
      },
      options.maxRetries,
      logger,
      'Search page navigation',
    );

    if (!navigateSuccess) {
      logger.error('Failed to load search page');
      await browser.close();
      return { organizations, rawData };
    }

    logger.success('Search page loaded');

    // Wait for search results
    const resultsFound = await withRetry(
      async () => {
        await page.waitForSelector('a[href*="/moscow/firm/"]', { timeout: 30000 });
        return true;
      },
      options.maxRetries,
      logger,
      'Waiting for search results',
    );

    if (!resultsFound) {
      logger.error('No search results found');
      await browser.close();
      return { organizations, rawData };
    }

    // Extract firm URLs
    const firmUrls = await page.$$eval('a[href*="/moscow/firm/"]', (links) =>
      links.slice(0, 50).map((link) => (link as HTMLAnchorElement).href),
    );

    const totalToScrape = Math.min(firmUrls.length, options.maxRecords);
    logger.info(`Found ${firmUrls.length} results, will scrape ${totalToScrape}`);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < totalToScrape; i++) {
      const url = firmUrls[i];
      if (!url) continue;

      logger.progress(i + 1, totalToScrape, `Processing: ${url.split('/').pop()}`);

      // Use retry wrapper for each firm page
      const result = await withRetry(
        async () => scrapeSingleOrganization(page, url, capturedResponses, options, logger),
        options.maxRetries,
        logger,
        'Scraping organization',
      );

      if (result) {
        organizations.push(result.organization);
        rawData.push(result.rawData);
        logger.success(
          `${result.organization.name} | Phone: ${result.organization.phone ?? '-'} | Rating: ${result.organization.rating ?? '-'}`,
        );
        successCount++;
      } else {
        failureCount++;
      }
    }

    logger.info(`Scraping complete: ${successCount} succeeded, ${failureCount} failed`);
  } finally {
    await browser.close();
    logger.debug('Browser closed');
  }

  return { organizations, rawData };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    query: 'кальян',
    delay: '2000',
    'max-records': '50',
    'max-retries': '3',
  });

  const options: ScraperOptions = {
    query: args.query,
    delayMs: Number(args.delay),
    maxRecords: Number(args['max-records']),
    maxRetries: Number(args['max-retries']),
  };

  const logger = new Logger();
  logger.info(`Scraping 2GIS for "${options.query}" in Moscow`);
  logger.info(
    `Configuration: delay=${options.delayMs}ms, maxRecords=${options.maxRecords}, retries=${options.maxRetries}`,
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
    console.log(`  Address: ${org.address}`);
    console.log(`  Phone: ${org.phone ?? '-'}`);
    console.log(`  Website: ${org.website ?? '-'}`);
    console.log(`  Rating: ${org.rating ?? '-'} (${org.reviewCount ?? 0} reviews)`);
    console.log(`  Rubrics: ${org.rubrics.join(', ')}`);
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

  // Save raw data (API responses + initialState)
  await saveRawData(`search-scrape-raw-${slug}-${fileTimestamp}.json`, metadata, rawData);
  logger.success(`Raw data saved (${rawData.length} items)`);

  // Save parsed organizations
  await saveParsedData(`search-scrape-${slug}-${fileTimestamp}.json`, metadata, organizations);
  logger.success(`Parsed data saved (${organizations.length} items)`);

  console.log(`\n${'='.repeat(80)}`);
  logger.success('Scraping completed successfully!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
