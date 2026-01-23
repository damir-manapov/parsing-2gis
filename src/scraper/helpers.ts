import type { Page } from 'playwright';
import { REQUEST_BLOCKING } from '../config.js';
import type { DataExtractionResult } from '../types/index.js';
import type { Logger } from '../utils.js';
import { sleep } from '../utils.js';

// Block unnecessary resources to improve performance
export async function setupRequestBlocking(page: Page, logger: Logger) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const resourceType = route.request().resourceType();

    // Block images, fonts, media, stylesheets to speed up scraping
    // biome-ignore lint/suspicious/noExplicitAny: resourceType needs runtime type checking
    if (REQUEST_BLOCKING.resourceTypes.includes(resourceType as any)) {
      route.abort();
      return;
    }

    // Block analytics, ads, and tracking
    if (REQUEST_BLOCKING.domains.some((domain) => url.includes(domain))) {
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
