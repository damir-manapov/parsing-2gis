// Run with: bun scripts/search-basic.ts

import { mkdir, writeFile } from 'node:fs/promises';
import { search, searchOrganizations } from '../src/api.js';

async function main() {
  const moscowViewpoint1 = { lon: 37.556366, lat: 55.926069 };
  const moscowViewpoint2 = { lon: 37.683974, lat: 55.581373 };

  console.log('Searching for "кальян" in Moscow...\n');

  const startTime = Date.now();
  const searchParams = {
    query: 'кальян',
    viewpoint1: moscowViewpoint1,
    viewpoint2: moscowViewpoint2,
  };

  // Get raw response
  const rawResponse = await search(searchParams);
  const responseTime = Date.now() - startTime;

  // Get parsed organizations
  const organizations = await searchOrganizations(searchParams);

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

  // Prepare metadata
  const timestamp = new Date().toISOString();
  const fileTimestamp = timestamp.replace(/[:.]/g, '-');
  const metadata = {
    fetchedAt: timestamp,
    apiVersion: rawResponse.meta.api_version,
    endpoint: 'search',
    statusCode: rawResponse.meta.code,
    query: searchParams,
    totalResults: rawResponse.result?.total ?? 0,
    responseTimeMs: responseTime,
  };

  // Save raw response with metadata
  await mkdir('data/raw', { recursive: true });
  const rawFile = `data/raw/kalyan-moscow-${fileTimestamp}.json`;
  await writeFile(rawFile, JSON.stringify({ meta: metadata, data: rawResponse }, null, 2));

  // Save parsed data with metadata
  await mkdir('data/parsed', { recursive: true });
  const parsedFile = `data/parsed/kalyan-moscow-${fileTimestamp}.json`;
  await writeFile(parsedFile, JSON.stringify({ meta: metadata, data: organizations }, null, 2));

  console.log(`✅ Saved ${organizations.length} organizations`);
  console.log(`   Raw: ${rawFile}`);
  console.log(`   Parsed: ${parsedFile}`);
}

main().catch(console.error);
