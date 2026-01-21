// Run with: bun scripts/fetch-by-id.ts <organization-id>

import { mkdir, writeFile } from 'node:fs/promises';
import { getOrganizationById } from '../src/api.js';

async function main() {
  const id = process.argv[2];

  if (!id) {
    console.error('Usage: bun scripts/fetch-by-id.ts <organization-id>');
    console.error('Example: bun scripts/fetch-by-id.ts 70000001058714012_hash...');
    process.exit(1);
  }

  // Moscow viewport (default)
  const moscowViewpoint1 = { lon: 37.536767, lat: 55.925802 };
  const moscowViewpoint2 = { lon: 37.703573, lat: 55.581639 };

  console.log(`Fetching organization: ${id}\n`);

  const startTime = Date.now();
  const byIdParams = {
    id,
    viewpoint1: moscowViewpoint1,
    viewpoint2: moscowViewpoint2,
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
  const fileTimestamp = timestamp.replace(/[:.]/g, '-');
  const metadata = {
    fetchedAt: timestamp,
    apiVersion: '3.0.x', // We don't have access to raw response here
    endpoint: 'byid',
    statusCode: 200,
    query: byIdParams,
    responseTimeMs: responseTime,
  };

  // Save parsed data with metadata (no raw data available from getOrganizationById)
  await mkdir('data/parsed', { recursive: true });
  const parsedFile = `data/parsed/org-${org.id}-${fileTimestamp}.json`;
  await writeFile(parsedFile, JSON.stringify({ meta: metadata, data: org }, null, 2));

  console.log(`\n✅ Saved to ${parsedFile}`);
  console.log('Note: Raw response not available (getOrganizationById returns parsed data only)');
}

main().catch(console.error);
