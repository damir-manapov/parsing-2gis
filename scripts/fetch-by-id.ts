// Run with: bun scripts/fetch-by-id.ts <organization-id> [--lat1 55.926069] [--lon1 37.556366] [--lat2 55.581373] [--lon2 37.683974]
// bun scripts/fetch-by-id.ts 70000001044609041_d5x9ik89dBdB9A824J7H1J2JH0IIGHGJkc7iqzjD39-c17d09136956I15491926-d8d5048B646J289370A77541479J3JIf8i3b78B8d33G4G1732000012H3J3H321J1306584i

import { getOrganizationById } from '../src/api.js';
import {
  createFileTimestamp,
  createMetadata,
  MOSCOW_BYID_VIEWPOINT_1,
  MOSCOW_BYID_VIEWPOINT_2,
  parseArgs,
  parseViewpoints,
  printOrganization,
  saveParsedData,
} from '../src/utils.js';

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
    lat1: String(MOSCOW_BYID_VIEWPOINT_1.lat),
    lon1: String(MOSCOW_BYID_VIEWPOINT_1.lon),
    lat2: String(MOSCOW_BYID_VIEWPOINT_2.lat),
    lon2: String(MOSCOW_BYID_VIEWPOINT_2.lon),
  });

  const { viewpoint1, viewpoint2 } = parseViewpoints(args);

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

  printOrganization(org);

  // Prepare metadata
  const fileTimestamp = createFileTimestamp();
  const metadata = createMetadata({
    apiVersion: '3.0.x', // We don't have access to raw response here
    endpoint: 'byid',
    statusCode: 200,
    query: byIdParams,
    responseTimeMs: responseTime,
  });

  // Save parsed data
  const parsedFile = await saveParsedData(`org-${org.id}-${fileTimestamp}.json`, metadata, org);

  console.log(`\n✅ Saved to ${parsedFile}`);
  console.log('Note: Raw response not available (getOrganizationById returns parsed data only)');
}

main().catch(console.error);
