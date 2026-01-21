// Run with: bun scripts/enrich-search.ts

import { writeFile } from 'node:fs/promises';
import { getOrganizationById, search } from '../src/api.js';
import type { Organization } from '../src/types.js';

const DELAY_MS = 500; // Delay between requests to avoid rate limiting

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const moscowViewpoint1 = { lon: 37.556366, lat: 55.926069 };
  const moscowViewpoint2 = { lon: 37.683974, lat: 55.581373 };
  const query = 'кальян';

  console.log(`Searching for "${query}" in Moscow...\n`);

  // Step 1: Search for organizations
  const searchResponse = await search({
    query,
    viewpoint1: moscowViewpoint1,
    viewpoint2: moscowViewpoint2,
  });

  const items = searchResponse.result?.items ?? [];
  const branches = items.filter((item) => item.type === 'branch');

  console.log(`Found ${branches.length} organizations. Enriching with contact details...\n`);

  // Step 2: Fetch full details for each organization
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

    // Delay to avoid rate limiting
    if (i < branches.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nEnriched ${enrichedOrgs.length} organizations.\n`);

  // Step 3: Save to data folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `data/kalyan-moscow-enriched-${timestamp}.json`;
  await writeFile(filename, JSON.stringify(enrichedOrgs, null, 2));
  console.log(`✅ Saved to ${filename}`);

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
