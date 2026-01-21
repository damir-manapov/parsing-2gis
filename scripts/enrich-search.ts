// Run with: bun scripts/enrich-search.ts

import { mkdir, writeFile } from 'node:fs/promises';
import { getOrganizationById, search } from '../src/api.js';
import type { Organization } from '../src/types.js';

const DELAY_MS = 500; // Delay between requests to avoid rate limiting

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichOrganizations(
  branches: Array<{ id: string; name: string }>,
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
      await sleep(DELAY_MS);
    }
  }

  return enrichedOrgs;
}

async function main() {
  const moscowViewpoint1 = { lon: 37.556366, lat: 55.926069 };
  const moscowViewpoint2 = { lon: 37.683974, lat: 55.581373 };
  const query = 'кальян';

  console.log(`Searching for "${query}" in Moscow...\n`);

  const startTime = Date.now();
  // Step 1: Search for organizations
  const searchResponse = await search({
    query,
    viewpoint1: moscowViewpoint1,
    viewpoint2: moscowViewpoint2,
  });
  const searchResponseTime = Date.now() - startTime;

  const items = searchResponse.result?.items ?? [];
  const branches = items.filter((item) => item.type === 'branch');

  console.log(`Found ${branches.length} organizations. Enriching with contact details...\n`);

  // Step 2: Fetch full details for each organization
  const byIdStartTime = Date.now();
  const enrichedOrgs = await enrichOrganizations(branches);
  const byIdResponseTime = Date.now() - byIdStartTime;

  console.log(`\nEnriched ${enrichedOrgs.length} organizations.\n`);

  // Step 3: Prepare metadata and save
  const timestamp = new Date().toISOString();
  const fileTimestamp = timestamp.replace(/[:.]/g, '-');
  const metadata = {
    fetchedAt: timestamp,
    apiVersion: searchResponse.meta.api_version,
    endpoint: 'search+byid',
    statusCode: searchResponse.meta.code,
    query,
    totalResults: searchResponse.result?.total ?? 0,
    enrichedCount: enrichedOrgs.length,
    searchResponseTimeMs: searchResponseTime,
    byIdResponseTimeMs: byIdResponseTime,
    totalResponseTimeMs: Date.now() - startTime,
  };

  // Save raw search response with metadata
  await mkdir('data/raw', { recursive: true });
  const rawFile = `data/raw/kalyan-moscow-enriched-${fileTimestamp}.json`;
  await writeFile(rawFile, JSON.stringify({ meta: metadata, searchData: searchResponse }, null, 2));

  // Save parsed enriched data with metadata
  await mkdir('data/parsed', { recursive: true });
  const parsedFile = `data/parsed/kalyan-moscow-enriched-${fileTimestamp}.json`;
  await writeFile(parsedFile, JSON.stringify({ meta: metadata, data: enrichedOrgs }, null, 2));

  console.log(`✅ Saved ${enrichedOrgs.length} organizations`);
  console.log(`   Raw: ${rawFile}`);
  console.log(`   Parsed: ${parsedFile}`);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total: ${enrichedOrgs.length}`);
  console.log(`With phone: ${enrichedOrgs.filter((o) => o.phone).length}`);
  console.log(`With website: ${enrichedOrgs.filter((o) => o.website).length}`);
  console.log(`With email: ${enrichedOrgs.filter((o) => o.email).length}`);
  console.log(`With telegram: ${enrichedOrgs.filter((o) => o.telegram).length}`);
  console.log(`With VK: ${enrichedOrgs.filter((o) => o.vkontakte).length}`);
}

main().catch(console.error);
