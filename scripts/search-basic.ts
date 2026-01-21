// Run with: bun scripts/search-basic.ts

import { writeFile } from 'node:fs/promises';
import { searchOrganizations } from '../src/api.js';

async function main() {
  const moscowViewpoint1 = { lon: 37.556366, lat: 55.926069 };
  const moscowViewpoint2 = { lon: 37.683974, lat: 55.581373 };

  console.log('Searching for "кальян" in Moscow...\n');

  const organizations = await searchOrganizations({
    query: 'кальян',
    viewpoint1: moscowViewpoint1,
    viewpoint2: moscowViewpoint2,
  });

  console.log(`Found ${organizations.length} organizations:\n`);

  for (const org of organizations) {
    console.log(`📍 ${org.name}`);
    console.log(
      `   Address: ${org.address}${org.addressComment ? ` (${org.addressComment})` : ''}`,
    );
    console.log(`   City: ${org.city ?? 'N/A'}, District: ${org.district ?? 'N/A'}`);
    console.log(`   Rating: ${org.rating ?? 'N/A'} (${org.reviewCount ?? 0} reviews)`);
    console.log(`   Rubrics: ${org.rubrics.map((r) => r.name).join(', ')}`);
    console.log(`   Coordinates: ${org.point.lat}, ${org.point.lon}`);
    if (org.orgName) {
      console.log(`   Organization: ${org.orgName} (${org.orgBranchCount ?? 0} branches)`);
    }
    console.log('');
  }

  // Save to data folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `data/kalyan-moscow-${timestamp}.json`;
  await writeFile(filename, JSON.stringify(organizations, null, 2));
  console.log(`✅ Saved ${organizations.length} organizations to ${filename}`);
}

main().catch(console.error);
