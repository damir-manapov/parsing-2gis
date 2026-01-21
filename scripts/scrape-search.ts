// Run with: bun scripts/scrape-search.ts [--query "кальян"] [--delay 2000]
// Uses Playwright to scrape 2GIS search results and detail pages

import { chromium } from 'playwright';
import {
  createFileTimestamp,
  createMetadata,
  parseArgs,
  saveParsedData,
  saveRawData,
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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeSearchResults(
  query: string,
  delayMs: number,
): Promise<{ organizations: ScrapedOrganization[]; rawData: any[] }> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  const organizations: ScrapedOrganization[] = [];
  const capturedResponses: any[] = [];
  const rawData: any[] = []; // Store raw API responses and initialState data

  // Debug: log all API calls
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('catalog.api.2gis') || url.includes('2gis')) {
      console.log(`  🔍 API call: ${url.substring(0, 100)}...`);
    }
  });

  // Intercept API responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('catalog.api.2gis') && url.includes('/items/byid')) {
      console.log(`  📡 Intercepted API call: ${url}`);
      try {
        const json = await response.json();
        capturedResponses.push(json);
        console.log(
          `  📦 Captured API response for: ${json.result?.items?.[0]?.name ?? 'unknown'}`,
        );
      } catch (e) {
        console.log(`  ⚠️  Failed to parse response: ${e}`);
      }
    }
  });

  try {
    console.log(`Navigating to 2GIS search for "${query}"...\n`);

    // Navigate to 2GIS search
    const searchUrl = `https://2gis.ru/moscow/search/${encodeURIComponent(query)}`;
    console.log(`URL: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Page loaded, waiting for search results...');

    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-page.png', fullPage: true });
    console.log('Screenshot saved to debug-page.png');

    // Wait for search results to load - look for firm links
    await page.waitForSelector('a[href*="/moscow/firm/"]', { timeout: 30000 });
    console.log('Search results found!');

    // Get URLs instead of elements to avoid detached DOM issues
    const firmUrls = await page.$$eval('a[href*="/moscow/firm/"]', (links) =>
      links.slice(0, 12).map((link) => (link as HTMLAnchorElement).href),
    );
    console.log(`Found ${firmUrls.length} results\n`);

    for (let i = 0; i < firmUrls.length; i++) {
      const url = firmUrls[i];
      if (!url) continue;

      try {
        console.log(`[${i + 1}/${firmUrls.length}] Opening: ${url}`);

        // Clear previous responses
        capturedResponses.length = 0;

        // Navigate to firm page - this will trigger API call OR use initialState
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Wait longer for API response to be captured
        await sleep(delayMs);

        console.log(`  Captured ${capturedResponses.length} API responses`);

        let item: any = null;

        // Try to get from captured API response first
        if (capturedResponses.length > 0) {
          const apiData = capturedResponses[0];
          item = apiData.result?.items?.[0];
          rawData.push({ source: 'api', url, data: apiData });
          console.log(`  Using API response`);
        } else {
          // Fallback: extract from window.initialState (pre-rendered data)
          try {
            const initialState = await page.evaluate(() => (window as any).initialState);
            const profileData = initialState?.data?.entity?.profile;
            if (profileData) {
              // Get first profile entry
              const profiles = Object.values(profileData);
              if (profiles.length > 0) {
                item = (profiles[0] as any)?.data;
                rawData.push({ source: 'initialState', url, data: initialState });
                console.log(`  Using initialState`);
              }
            }
          } catch (e) {
            console.log(`  ⚠️  Failed to extract initialState: ${e}`);
          }
        }

        // Extract from item data
        if (item) {
          const org: ScrapedOrganization = {
            name: item.name ?? '',
            address: item.address_name ?? '',
            phone: item.contact_groups
              ?.find((g: any) => g.contacts?.find((c: any) => c.type === 'phone'))
              ?.contacts?.find((c: any) => c.type === 'phone')?.value,
            website: item.contact_groups
              ?.find((g: any) => g.contacts?.find((c: any) => c.type === 'website'))
              ?.contacts?.find((c: any) => c.type === 'website')?.value,
            rating: item.reviews?.rating,
            reviewCount: item.reviews?.general_rating_count,
            rubrics: item.rubrics?.map((r: any) => r.name) ?? [],
          };

          organizations.push(org);
          console.log(`  ✓ ${org.name}`);
          console.log(`    Phone: ${org.phone ?? '-'} | Website: ${org.website ?? '-'}`);
        } else {
          console.log(`  ✗ No data found`);
        }

        // Go back to search results
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(500);
      } catch (error) {
        console.log(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  } finally {
    await browser.close();
  }

  return { organizations, rawData };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    query: 'кальян',
    delay: '2000',
  });

  const delayMs = Number(args.delay);

  console.log(`Scraping 2GIS for "${args.query}" in Moscow...\n`);

  const startTime = Date.now();
  const { organizations, rawData } = await scrapeSearchResults(args.query, delayMs);
  const responseTime = Date.now() - startTime;

  console.log(`\n\nScraped ${organizations.length} organizations in ${responseTime}ms.\n`);

  // Display summary
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
    query: args.query,
    totalResults: organizations.length,
    responseTimeMs: responseTime,
  });

  const slug = slugify(args.query);

  // Save raw data (API responses + initialState)
  await saveRawData(`search-scrape-raw-${slug}-${fileTimestamp}.json`, metadata, rawData);

  // Save parsed organizations
  await saveParsedData(`search-scrape-${slug}-${fileTimestamp}.json`, metadata, organizations);

  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
