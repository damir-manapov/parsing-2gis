import { searchOrganizations } from './api.js';

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
}

main().catch(console.error);
