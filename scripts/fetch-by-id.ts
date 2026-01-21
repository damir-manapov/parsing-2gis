// Run with: bun scripts/fetch-by-id.ts <organization-id>

import { writeFile } from 'node:fs/promises';
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

  const org = await getOrganizationById({
    id,
    viewpoint1: moscowViewpoint1,
    viewpoint2: moscowViewpoint2,
  });

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

  // Save to data folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `data/org-${org.id}-${timestamp}.json`;
  await writeFile(filename, JSON.stringify(org, null, 2));
  console.log(`\n✅ Saved to ${filename}`);
}

main().catch(console.error);
