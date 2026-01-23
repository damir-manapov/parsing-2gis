import type { Page } from 'playwright';
import { chromium } from 'playwright';
import type { DataExtractionResult, ScrapedOrganization, ScraperOptions } from '../types/index.js';
import { Logger, sleep } from '../utils.js';
import { DEFAULT_NAVIGATION_TIMEOUT, DEFAULT_WAIT_TIMEOUT } from './constants.js';
import { extractOrganization } from './organization.js';
import { scrapeReviews } from './reviews.js';

// Block unnecessary resources to improve performance
export async function setupRequestBlocking(page: Page, logger: Logger) {
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
export async function withRetry<T>(
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

// Extract data from page using initialState
export async function extractDataFromPage(
  page: Page,
  logger: Logger,
): Promise<DataExtractionResult | null> {
  try {
    const extraction = await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: Browser window object is dynamic
      const initialState = (window as any).initialState;
      const profileData = initialState?.data?.entity?.profile;

      if (profileData) {
        const profiles = Object.values(profileData);
        if (profiles.length > 0) {
          // biome-ignore lint/suspicious/noExplicitAny: 2GIS profile structure is dynamic
          const item = (profiles[0] as any)?.data;
          if (item) {
            return {
              item,
              source: 'initialState' as const,
              fullData: initialState,
            };
          }
        }
      }

      return null;
    });

    if (extraction) {
      logger.debug('Extracted data from initialState');
    }

    return extraction;
  } catch (e) {
    logger.warn(`Failed to extract data: ${e}`);
    return null;
  }
}

async function scrapeSingleOrganization(
  page: Page,
  url: string,
  logger: Logger,
  options: ScraperOptions,
  // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
): Promise<{ organization: ScrapedOrganization; rawData: any } | null> {
  const startTime = Date.now();

  // Navigate to firm page and wait for DOM to load
  const navStart = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_NAVIGATION_TIMEOUT });
  const navTime = Date.now() - navStart;
  logger.debug(`⏱️  Navigation: ${navTime}ms`);

  // Wait for initialState to be available
  const waitStart = Date.now();
  // biome-ignore lint/suspicious/noExplicitAny: Browser window object is dynamic
  await page.waitForFunction(() => typeof (window as any).initialState !== 'undefined', {
    timeout: 5000,
  });
  const waitTime = Date.now() - waitStart;
  logger.debug(`⏱️  Wait for initialState: ${waitTime}ms`);

  // Extract data from page
  const extractStart = Date.now();
  const extraction = await extractDataFromPage(page, logger);
  const extractTime = Date.now() - extractStart;
  logger.debug(`⏱️  Data extraction: ${extractTime}ms`);

  if (!extraction) {
    throw new Error('No data found for this organization');
  }

  const { item, source, fullData } = extraction;

  // Build raw data entry - save only organization-related data
  const profileData = fullData?.data?.entity?.profile;
  const rawDataContent = profileData
    ? {
        meta: fullData?.meta,
        result: {
          items: [item],
        },
      }
    : fullData; // Fallback to full state if structure is unexpected

  const rawData = {
    source,
    url,
    data: rawDataContent,
  };

  // Extract organization data
  const organization = extractOrganization(item, logger);

  // Scrape reviews if in full-with-reviews mode
  if (options.scrapingMode === 'full-with-reviews' && item.id) {
    const reviewsStart = Date.now();
    const reviews = await scrapeReviews(page, item.id, options.maxReviewsPerOrg, logger);
    const reviewsTime = Date.now() - reviewsStart;
    logger.debug(`⏱️  Reviews extraction: ${reviewsTime}ms (${reviews.length} reviews)`);
    organization.reviews = reviews;
  }

  const totalTime = Date.now() - startTime;
  logger.debug(`⏱️  Total page time: ${totalTime}ms`);

  return { organization, rawData };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Main orchestration function handles multiple scraping modes
export async function scrapeSearchResults(
  options: ScraperOptions,
  // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
): Promise<{ organizations: ScrapedOrganization[]; rawData: any[] }> {
  const logger = new Logger();
  logger.info(
    `Starting scraper with options: maxRecords=${options.maxRecords}, delay=${options.delayMs}ms, retries=${options.maxRetries}, headless=${options.headless}, mode=${options.scrapingMode}${options.scrapingMode === 'full-with-reviews' ? `, reviews=${options.maxReviewsPerOrg}` : ''}`,
  );

  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Setup request blocking
  await setupRequestBlocking(page, logger);

  const organizations: ScrapedOrganization[] = [];
  // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
  const rawData: any[] = [];

  try {
    logger.info(`Navigating to 2GIS search for "${options.query}"...`);

    // Navigate to search page with retry
    const searchUrl = `https://2gis.ru/moscow/search/${encodeURIComponent(options.query)}`;

    const navigateSuccess = await withRetry(
      async () => {
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: DEFAULT_WAIT_TIMEOUT,
        });
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
        await page.waitForSelector('a[href*="/moscow/firm/"]', {
          timeout: DEFAULT_NAVIGATION_TIMEOUT,
        });
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

    // For 'list' mode, extract basic data from search results without navigation
    if (options.scrapingMode === 'list') {
      logger.info('List mode: extracting basic data from search results');

      const basicData = await page.evaluate((maxRecords) => {
        // biome-ignore lint/suspicious/noExplicitAny: Search result items have dynamic structure
        const results: any[] = [];
        const links = document.querySelectorAll('a[href*="/moscow/firm/"]');

        for (const link of Array.from(links).slice(0, maxRecords)) {
          const container =
            link.closest('[data-id]') || link.closest('article') || link.parentElement;
          const firmId = link.getAttribute('href')?.match(/firm\/(\d+)/)?.[1];

          if (firmId) {
            results.push({
              firmId,
              url: link.getAttribute('href'),
              name: link.textContent?.trim() || '',
              container: container?.outerHTML || '',
            });
          }
        }

        return results;
      }, totalToScrape);

      for (let i = 0; i < Math.min(basicData.length, totalToScrape); i++) {
        const item = basicData[i];
        if (!item) continue;

        logger.progress(i + 1, totalToScrape, `Processing: ${item.firmId}`);

        // Extract minimal data from search results
        const organization: ScrapedOrganization = {
          name: item.name,
          address: '',
          rubrics: [],
          orgId: item.firmId,
        };

        organizations.push(organization);
        rawData.push(item);
        logger.success(`${organization.name} (list mode)`);
        successCount++;
      }
    } else {
      // For 'full' and 'full-with-reviews' modes, navigate to each page
      for (let i = 0; i < totalToScrape; i++) {
        const url = firmUrls[i];
        if (!url) continue;

        logger.progress(i + 1, totalToScrape, `Processing: ${url.split('/').pop()}`);

        // Use retry wrapper for each firm page
        const result = await withRetry(
          async () => scrapeSingleOrganization(page, url, logger, options),
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
    }

    logger.info(`Scraping complete: ${successCount} succeeded, ${failureCount} failed`);
  } finally {
    await browser.close();
    logger.debug('Browser closed');
  }

  return { organizations, rawData };
}
