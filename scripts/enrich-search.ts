// Run with: bun scripts/enrich-search.ts [--query "кальян"] [--lat1 55.926069] [--lon1 37.556366] [--lat2 55.581373] [--lon2 37.683974] [--delay 500]

import { getOrganizationById, search } from '../src/api.js';
import type { Organization } from '../src/types.js';
import {
  createFileTimestamp,
  parseArgs,
  printOrganizationSummary,
  saveParsedData,
  saveRawData,
} from '../src/utils.js';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichOrganizations(
  branches: Array<{ id: string; name: string }>,
  delayMs: number,
): Promise<Organization[]> {
  const enrichedOrgs: Organization[] = [];

  for (let i = 0; i < branches.length; i++) {
    const item = branches[i];
    if (!item) continue;

    console.log(`[${i + 1}/${branches.length}] Fetching: ${item.name}`);

    try {
      const org = await getOrganizationById({ id: item.id });
      if (org) {
        enrichedOrgs.push(org);
        console.log(`  ✓ Phone: ${org.phone ?? '-'} | Website: ${org.website ?? '-'}`);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    if (i < branches.length - 1) {
      await sleep(delayMs);
    }
  }

  return enrichedOrgs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    query: 'кальян',
    lat1: '55.926069',
    lon1: '37.556366',
    lat2: '55.581373',
    lon2: '37.683974',
    delay: '500',
  });

  const viewpoint1 = { lon: Number(args.lon1), lat: Number(args.lat1) };
  const viewpoint2 = { lon: Number(args.lon2), lat: Number(args.lat2) };
  const delayMs = Number(args.delay);

  console.log(`Searching for "${args.query}" in Moscow...\n`);

  const startTime = Date.now();
  // Step 1: Search for organizations
  const searchResponse = await search({
    query: args.query,
    viewpoint1,
    viewpoint2,
  });
  const searchResponseTime = Date.now() - startTime;

  const items = searchResponse.result?.items ?? [];
  const branches = items.filter((item) => item.type === 'branch');

  console.log(`Found ${branches.length} organizations. Enriching with contact details...\n`);

  // Step 2: Fetch full details for each organization
  const byIdStartTime = Date.now();
  const enrichedOrgs = await enrichOrganizations(branches, delayMs);
  const byIdResponseTime = Date.now() - byIdStartTime;

  console.log(`\nEnriched ${enrichedOrgs.length} organizations.\n`);

  // Step 3: Prepare metadata and save
  const timestamp = new Date().toISOString();
  const fileTimestamp = createFileTimestamp();
  const metadata = {
    fetchedAt: timestamp,
    apiVersion: searchResponse.meta.api_version,
    endpoint: 'search+byid',
    statusCode: searchResponse.meta.code,
    query: args.query,
    totalResults: searchResponse.result?.total ?? 0,
    enrichedCount: enrichedOrgs.length,
    searchResponseTimeMs: searchResponseTime,
    byIdResponseTimeMs: byIdResponseTime,
    totalResponseTimeMs: Date.now() - startTime,
  };

  // Save files
  const querySlug = args.query.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const rawFile = await saveRawData(
    `${querySlug}-moscow-enriched-${fileTimestamp}.json`,
    metadata,
    { searchData: searchResponse },
  );
  const parsedFile = await saveParsedData(
    `${querySlug}-moscow-enriched-${fileTimestamp}.json`,
    metadata,
    enrichedOrgs,
  );

  console.log(`✅ Saved ${enrichedOrgs.length} organizations`);
  console.log(`   Raw: ${rawFile}`);
  console.log(`   Parsed: ${parsedFile}`);

  printOrganizationSummary(enrichedOrgs);
}

main().catch(console.error);
