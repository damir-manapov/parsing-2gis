import { ScraperRepository } from '../repository.js';
import type { ScrapedOrganization, ScraperOptions } from '../types/index.js';
import { Logger } from '../utils.js';
import { closeBrowser, createBrowserSession } from './browser.js';
import { DEFAULT_NAVIGATION_TIMEOUT, DEFAULT_WAIT_TIMEOUT } from './constants.js';
import { withRetry } from './helpers.js';
import { scrapeSingleOrganization } from './single-org.js';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Main orchestration function handles multiple scraping modes
export async function scrapeSearchResults(
  options: ScraperOptions,
  // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
): Promise<{ organizations: ScrapedOrganization[]; rawData: any[] }> {
  const logger = new Logger();
  logger.info(
    `Starting scraper with options: maxRecords=${options.maxRecords}, delay=${options.delayMs}ms, retries=${options.maxRetries}, headless=${options.headless}, mode=${options.scrapingMode}${options.scrapingMode === 'full-with-reviews' ? `, reviews=${options.maxReviewsPerOrg}` : ''}`,
  );

  const { browser, page } = await createBrowserSession(options.headless, logger);

  const organizations: ScrapedOrganization[] = [];
  // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
  const rawData: any[] = [];

  try {
    // If fromList is provided, read list file and scrape each org
    if (options.fromList) {
      logger.info(`Reading list file: ${options.fromList}`);
      const repository = new ScraperRepository(logger);
      const listData = await repository.readListFile(options.fromList);
      const orgIds = listData.orgIds.slice(0, options.maxRecords);

      logger.info(`Found ${listData.orgIds.length} orgs in list, will scrape ${orgIds.length}`);

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < orgIds.length; i++) {
        const orgId = orgIds[i];
        if (!orgId) continue;

        logger.progress(i + 1, orgIds.length, `Processing org: ${orgId}`);

        const orgUrl = `https://2gis.ru/moscow/firm/${orgId}`;
        const result = await withRetry(
          async () => scrapeSingleOrganization(page, orgUrl, logger, options),
          options.maxRetries,
          logger,
          `Scraping organization ${orgId}`,
        );

        if (result) {
          organizations.push(result.organization);
          rawData.push(result.rawData);
          logger.success(
            `${result.organization.name} | Phone: ${result.organization.phone ?? '-'} | Rating: ${result.organization.rating ?? '-'}`,
          );
          successCount++;
        } else {
          logger.error(`Failed to scrape organization ${orgId}`);
          failureCount++;
        }
      }

      logger.info(`Scraping from list complete: ${successCount} succeeded, ${failureCount} failed`);
      await closeBrowser(browser, logger);
      return { organizations, rawData };
    }

    // If orgId is provided, scrape single organization directly
    if (options.orgId) {
      logger.info(`Scraping organization by ID: ${options.orgId}`);
      const orgUrl = `https://2gis.ru/moscow/firm/${options.orgId}`;

      const result = await withRetry(
        async () => scrapeSingleOrganization(page, orgUrl, logger, options),
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
      } else {
        logger.error(`Failed to scrape organization ${options.orgId}`);
      }

      await closeBrowser(browser, logger);
      return { organizations, rawData };
    }

    // Otherwise, proceed with search query
    if (!options.query) {
      logger.error('Either query or orgId must be provided');
      await closeBrowser(browser, logger);
      return { organizations, rawData };
    }

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
      await closeBrowser(browser, logger);
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
      await closeBrowser(browser, logger);
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
    await closeBrowser(browser, logger);
  }

  return { organizations, rawData };
}
