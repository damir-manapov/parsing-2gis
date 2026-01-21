// Run with: bun scripts/fetch-by-id.ts <organization-id> [--lat1 55.925802] [--lon1 37.536767] [--lat2 55.581639] [--lon2 37.703573]

import { getOrganizationById } from '../src/api.js';
import { createFileTimestamp, parseArgs, saveParsedData } from '../src/utils.js';

async function main() {
  const id = process.argv[2];

  if (!id) {
    console.error(
      'Usage: bun scripts/fetch-by-id.ts <organization-id> [--lat1 55.925802] [--lon1 37.536767] [--lat2 55.581639] [--lon2 37.703573]',
    );
    console.error('Example: bun scripts/fetch-by-id.ts 70000001058714012_hash...');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(3), {
    lat1: '55.925802',
    lon1: '37.536767',
    lat2: '55.581639',
    lon2: '37.703573',
  });

  const viewpoint1 = { lon: Number(args.lon1), lat: Number(args.lat1) };
  const viewpoint2 = { lon: Number(args.lon2), lat: Number(args.lat2) };

  console.log(`Fetching organization: ${id}\n`);

  const startTime = Date.now();
  const byIdParams = {
    id,
    viewpoint1,
    viewpoint2,
  };

  const org = await getOrganizationById(byIdParams);
  const responseTime = Date.now() - startTime;

  if (!org) {
    console.error('Organization not found');
    process.exit(1);
  }

  console.log('=== Organization ===');
  console.log(`Name: ${org.name}`);
  console.log(`Address: ${org.address}${org.addressComment ? ` (${org.addressComment})` : ''}`);
  console.log(`City: ${org.city ?? 'N/A'}, District: ${org.district ?? 'N/A'}`);
  console.log(`Coordinates: ${org.point.lat}, ${org.point.lon}`);
  console.log(`Rating: ${org.rating ?? 'N/A'} (${org.reviewCount ?? 0} reviews)`);
  console.log(`Rubrics: ${org.rubrics.map((r) => r.name).join(', ')}`);

  console.log('\n=== Contacts ===');
  console.log(`Phone: ${org.phone ?? '-'}`);
  console.log(`Website: ${org.website ?? '-'}`);
  console.log(`Email: ${org.email ?? '-'}`);
  console.log(`Telegram: ${org.telegram ?? '-'}`);
  console.log(`VK: ${org.vkontakte ?? '-'}`);

  if (org.orgName) {
    console.log('\n=== Organization Info ===');
    console.log(`Org: ${org.orgName} (${org.orgBranchCount ?? 0} branches)`);
  }

  // Prepare metadata
  const timestamp = new Date().toISOString();
  const fileTimestamp = createFileTimestamp();
  const metadata = {
    fetchedAt: timestamp,
    apiVersion: '3.0.x', // We don't have access to raw response here
    endpoint: 'byid',
    statusCode: 200,
    query: byIdParams,
    responseTimeMs: responseTime,
  };

  // Save parsed data
  const parsedFile = await saveParsedData(`org-${org.id}-${fileTimestamp}.json`, metadata, org);

  console.log(`\n✅ Saved to ${parsedFile}`);
  console.log('Note: Raw response not available (getOrganizationById returns parsed data only)');
}

main().catch(console.error);
