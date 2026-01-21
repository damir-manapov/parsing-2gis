// Run with: bun scripts/search-basic.ts [--query "кальян"] [--lat1 55.926069] [--lon1 37.556366] [--lat2 55.581373] [--lon2 37.683974]

import { search, searchOrganizations } from '../src/api.js';
import {
  createFileTimestamp,
  createMetadata,
  MOSCOW_VIEWPOINT_1,
  MOSCOW_VIEWPOINT_2,
  parseArgs,
  parseViewpoints,
  saveParsedData,
  saveRawData,
  slugify,
} from '../src/utils.js';

async function main() {
  const args = parseArgs(process.argv.slice(2), {
    query: 'кальян',
    lat1: String(MOSCOW_VIEWPOINT_1.lat),
    lon1: String(MOSCOW_VIEWPOINT_1.lon),
    lat2: String(MOSCOW_VIEWPOINT_2.lat),
    lon2: String(MOSCOW_VIEWPOINT_2.lon),
  });

  const { viewpoint1, viewpoint2 } = parseViewpoints(args);

  console.log(`Searching for "${args.query}" in Moscow...\n`);

  const startTime = Date.now();
  const searchParams = {
    query: args.query,
    viewpoint1,
    viewpoint2,
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
  const fileTimestamp = createFileTimestamp();
  const metadata = createMetadata({
    apiVersion: rawResponse.meta.api_version,
    endpoint: 'search',
    statusCode: rawResponse.meta.code,
    query: searchParams,
    totalResults: rawResponse.result?.total ?? 0,
    responseTimeMs: responseTime,
  });

  // Save files
  const querySlug = slugify(args.query);
  const rawFile = await saveRawData(
    `${querySlug}-moscow-${fileTimestamp}.json`,
    metadata,
    rawResponse,
  );
  const parsedFile = await saveParsedData(
    `${querySlug}-moscow-${fileTimestamp}.json`,
    metadata,
    organizations,
  );

  console.log(`✅ Saved ${organizations.length} organizations`);
  console.log(`   Raw: ${rawFile}`);
  console.log(`   Parsed: ${parsedFile}`);
}

main().catch(console.error);
