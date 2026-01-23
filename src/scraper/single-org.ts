import type { Page } from 'playwright';
import type { ScrapedOrganization, ScraperOptions } from '../types/index.js';
import type { Logger } from '../utils.js';
import { DEFAULT_NAVIGATION_TIMEOUT } from './constants.js';
import { extractDataFromPage } from './helpers.js';
import { extractOrganization } from './organization.js';
import { scrapeReviews } from './reviews.js';

export async function scrapeSingleOrganization(
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
