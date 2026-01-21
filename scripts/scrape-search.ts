// Run with: bun scripts/scrape-search.ts [--query "кальян"] [--delay 2000] [--max-records 50] [--headless]
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

// Configuration constants
const DEFAULT_NAVIGATION_TIMEOUT = 30000;
const DEFAULT_WAIT_TIMEOUT = 60000;

interface MetroStation {
  name: string;
  distance: number;
  line?: string;
  color?: string;
}

interface Coordinates {
  lat: number;
  lon: number;
}

interface ScrapedOrganization {
  name: string;
  description?: string;
  address: string;
  addressComment?: string;
  postcode?: string;
  city?: string;
  district?: string;
  region?: string;
  country?: string;
  timezone?: string;
  phone?: string;
  email?: string;
  website?: string;
  schedule?: string;
  rating?: number;
  reviewCount?: number;
  rubrics: string[];
  type?: string;
  // Additional fields
  coordinates?: Coordinates;
  nearestMetro?: MetroStation[];
  paymentMethods?: string[];
  features?: string[];
  orgName?: string;
  orgId?: string;
  branchCount?: number;
  photoCount?: number;
  hasPhotos?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ScraperOptions {
  query: string;
  delayMs: number;
  maxRecords: number;
  maxRetries: number;
  headless: boolean;
}

interface DataExtractionResult {
  item: any;
  source: 'api' | 'initialState';
  fullData?: any; // Store the full API response or initialState
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
function extractOrganization(item: any, logger: Logger): ScrapedOrganization {
  try {
    // Extract contacts with error handling
    const phone = findContact(item, 'phone');
    const email = findContact(item, 'email');
    const website = findContact(item, 'website');

    // Extract name and description
    let name = '';
    let description: string | undefined;

    try {
      if (item.name_ex) {
        name = item.name_ex.primary ?? item.name ?? '';
        description = item.name_ex.extension;
      } else {
        name = item.name ?? '';
      }
    } catch (e) {
      name = item.name ?? 'Unknown';
      logger.warn(`Failed to extract name: ${e}`);
    }

    // Extract address hierarchy
    let address = '';
    let addressComment: string | undefined;
    let postcode: string | undefined;
    let city: string | undefined;
    let district: string | undefined;
    let region: string | undefined;
    let country: string | undefined;

    try {
      address = item.address_name ?? '';
      addressComment = item.address_comment;

      if (item.address) {
        const addr = item.address;
        postcode = addr.postcode;

        // Extract address components
        if (addr.components) {
          for (const component of addr.components) {
            switch (component.type) {
              case 'city':
                city = component.name;
                break;
              case 'district':
                district = component.name;
                break;
              case 'region':
                region = component.name;
                break;
              case 'country':
                country = component.name;
                break;
            }
          }
        }
      }
    } catch (e) {
      logger.warn(`Failed to extract address details: ${e}`);
    }

    // Extract schedule
    let schedule: string | undefined;
    try {
      if (item.schedule?.working_hours) {
        const hours = item.schedule.working_hours;
        if (Array.isArray(hours) && hours.length > 0) {
          schedule = hours
            .map((h: any) => `${h.day}: ${h.working_hours?.join(', ') ?? 'closed'}`)
            .join('; ');
        } else if (typeof hours === 'string') {
          schedule = hours;
        }
      }
    } catch (e) {
      logger.debug(`Failed to extract schedule: ${e}`);
    }

    // Extract reviews with validation
    let rating: number | undefined;
    let reviewCount: number | undefined;
    try {
      if (item.reviews) {
        rating = typeof item.reviews.rating === 'number' ? item.reviews.rating : undefined;
        reviewCount =
          typeof item.reviews.general_rating_count === 'number'
            ? item.reviews.general_rating_count
            : undefined;
      }
    } catch (e) {
      logger.debug(`Failed to extract reviews: ${e}`);
    }

    // Extract rubrics with error handling
    let rubrics: string[] = [];
    try {
      if (Array.isArray(item.rubrics)) {
        rubrics = item.rubrics.map((r: any) => r.name).filter((n: any) => typeof n === 'string');
      }
    } catch (e) {
      logger.warn(`Failed to extract rubrics: ${e}`);
    }

    // Extract coordinates
    let coordinates: Coordinates | undefined;
    try {
      if (item.point?.lat && item.point?.lon) {
        coordinates = {
          lat: item.point.lat,
          lon: item.point.lon,
        };
      }
    } catch (e) {
      logger.debug(`Failed to extract coordinates: ${e}`);
    }

    // Extract nearest metro stations
    let nearestMetro: MetroStation[] | undefined;
    try {
      if (item.links?.nearest_stations && Array.isArray(item.links.nearest_stations)) {
        nearestMetro = item.links.nearest_stations
          .slice(0, 3) // Top 3 closest
          .map((station: any) => ({
            name: station.name,
            distance: station.distance,
            line: station.comment,
            color: station.color,
          }))
          .filter((s: any) => s.name);

        if (nearestMetro && nearestMetro.length === 0) nearestMetro = undefined;
      }
    } catch (e) {
      logger.debug(`Failed to extract metro stations: ${e}`);
    }

    // Extract payment methods and features
    let paymentMethods: string[] | undefined;
    let features: string[] | undefined;
    try {
      if (item.attribute_groups && Array.isArray(item.attribute_groups)) {
        const payments: string[] = [];
        const feats: string[] = [];

        for (const group of item.attribute_groups) {
          if (group.name === 'Способы оплаты' && Array.isArray(group.attributes)) {
            payments.push(...group.attributes.map((a: any) => a.name).filter(Boolean));
          } else if (Array.isArray(group.attributes)) {
            feats.push(...group.attributes.map((a: any) => a.name).filter(Boolean));
          }
        }

        if (payments.length > 0) paymentMethods = payments;
        if (feats.length > 0) features = feats;
      }
    } catch (e) {
      logger.debug(`Failed to extract attributes: ${e}`);
    }

    // Extract organization info
    let orgName: string | undefined;
    let orgId: string | undefined;
    let branchCount: number | undefined;
    try {
      if (item.org) {
        orgName = item.org.name || item.org.primary;
        orgId = item.org.id;
        branchCount = typeof item.org.branch_count === 'number' ? item.org.branch_count : undefined;
      }
    } catch (e) {
      logger.debug(`Failed to extract org info: ${e}`);
    }

    // Extract photo info
    let photoCount: number | undefined;
    let hasPhotos: boolean | undefined;
    try {
      if (item.external_content && Array.isArray(item.external_content)) {
        photoCount = item.external_content
          .filter((c: any) => c.type === 'photo_album')
          .reduce((sum: number, c: any) => sum + (c.count || 0), 0);

        if (photoCount === 0) photoCount = undefined;
      }

      if (item.flags?.photos) {
        hasPhotos = true;
      }
    } catch (e) {
      logger.debug(`Failed to extract photo info: ${e}`);
    }

    // Extract timestamps
    let createdAt: string | undefined;
    let updatedAt: string | undefined;
    try {
      if (item.dates) {
        createdAt = item.dates.created_at;
        updatedAt = item.dates.updated_at;
      }
    } catch (e) {
      logger.debug(`Failed to extract dates: ${e}`);
    }

    return {
      name,
      ...(description && { description }),
      address,
      ...(addressComment && { addressComment }),
      ...(postcode && { postcode }),
      ...(city && { city }),
      ...(district && { district }),
      ...(region && { region }),
      ...(country && { country }),
      ...(item.timezone && { timezone: item.timezone }),
      ...(phone && { phone }),
      ...(email && { email }),
      ...(website && { website }),
      ...(schedule && { schedule }),
      ...(rating !== undefined && { rating }),
      ...(reviewCount !== undefined && { reviewCount }),
      rubrics,
      ...(item.type && { type: item.type }),
      ...(coordinates && { coordinates }),
      ...(nearestMetro && { nearestMetro }),
      ...(paymentMethods && { paymentMethods }),
      ...(features && { features }),
      ...(orgName && { orgName }),
      ...(orgId && { orgId }),
      ...(branchCount !== undefined && { branchCount }),
      ...(photoCount !== undefined && { photoCount }),
      ...(hasPhotos !== undefined && { hasPhotos }),
      ...(createdAt && { createdAt }),
      ...(updatedAt && { updatedAt }),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to extract organization data: ${errorMsg}`);

    // Return minimal valid object
    return {
      name: item?.name ?? 'Unknown',
      address: item?.address_name ?? '',
      rubrics: [],
    };
  }
}

// Extract data from page using initialState
async function extractDataFromPage(
  page: Page,
  logger: Logger,
): Promise<DataExtractionResult | null> {
  try {
    const initialState = await page.evaluate(() => (window as any).initialState);
    const profileData = initialState?.data?.entity?.profile;
    if (profileData) {
      const profiles = Object.values(profileData);
      if (profiles.length > 0) {
        const item = (profiles[0] as any)?.data;
        if (item) {
          logger.debug('Extracted data from initialState');
          return { item, source: 'initialState', fullData: initialState };
        }
      }
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    logger.warn(`Failed to extract initialState: ${errorMsg}`);
  }

  return null;
}

// Scrape a single organization page
async function scrapeSingleOrganization(
  page: Page,
  url: string,
  logger: Logger,
): Promise<{ organization: ScrapedOrganization; rawData: any } | null> {
  const startTime = Date.now();

  // Navigate to firm page and wait for DOM to load
  const navStart = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: DEFAULT_NAVIGATION_TIMEOUT });
  const navTime = Date.now() - navStart;
  logger.debug(`⏱️  Navigation: ${navTime}ms`);

  // Wait for initialState to be available
  const waitStart = Date.now();
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

  const totalTime = Date.now() - startTime;
  logger.debug(`⏱️  Total page time: ${totalTime}ms`);

  return { organization, rawData };
}

async function scrapeSearchResults(
  options: ScraperOptions,
): Promise<{ organizations: ScrapedOrganization[]; rawData: any[] }> {
  const logger = new Logger();
  logger.info(
    `Starting scraper with options: maxRecords=${options.maxRecords}, delay=${options.delayMs}ms, retries=${options.maxRetries}, headless=${options.headless}`,
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

    for (let i = 0; i < totalToScrape; i++) {
      const url = firmUrls[i];
      if (!url) continue;

      logger.progress(i + 1, totalToScrape, `Processing: ${url.split('/').pop()}`);

      // Use retry wrapper for each firm page
      const result = await withRetry(
        async () => scrapeSingleOrganization(page, url, logger),
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
    headless: 'true',
  });

  const options: ScraperOptions = {
    query: args.query,
    delayMs: Number(args.delay),
    maxRecords: Number(args['max-records']),
    maxRetries: Number(args['max-retries']),
    headless: args.headless === 'true',
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
