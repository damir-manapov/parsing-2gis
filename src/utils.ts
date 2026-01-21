import { mkdir, writeFile } from 'node:fs/promises';
import type { Organization, Point } from './types.js';

// Logger utility with timestamps
export class Logger {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  private elapsed(): string {
    const ms = Date.now() - this.startTime;
    return `[${(ms / 1000).toFixed(1)}s]`;
  }

  info(message: string) {
    console.log(`${this.elapsed()} ℹ️  ${message}`);
  }

  success(message: string) {
    console.log(`${this.elapsed()} ✓ ${message}`);
  }

  error(message: string) {
    console.log(`${this.elapsed()} ✗ ${message}`);
  }

  warn(message: string) {
    console.log(`${this.elapsed()} ⚠️  ${message}`);
  }

  debug(message: string) {
    console.log(`${this.elapsed()} 🔍 ${message}`);
  }

  progress(current: number, total: number, message: string) {
    console.log(`${this.elapsed()} [${current}/${total}] ${message}`);
  }
}

// Moscow viewpoints for search endpoint
export const MOSCOW_SEARCH_VIEWPOINT_1: Point = { lon: 37.556366, lat: 55.926069 };
export const MOSCOW_SEARCH_VIEWPOINT_2: Point = { lon: 37.683974, lat: 55.581373 };

// Moscow viewpoints for byid endpoint
export const MOSCOW_BYID_VIEWPOINT_1: Point = { lon: 37.536767, lat: 55.925802 };
export const MOSCOW_BYID_VIEWPOINT_2: Point = { lon: 37.703573, lat: 55.581639 };

export interface Metadata {
  fetchedAt: string;
  apiVersion: string;
  endpoint: string;
  statusCode: number;
  query: unknown;
  responseTimeMs?: number;
  totalResults?: number;
  enrichedCount?: number;
  searchResponseTimeMs?: number;
  byIdResponseTimeMs?: number;
  totalResponseTimeMs?: number;
}

export function createFileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function saveRawData(
  filename: string,
  metadata: Metadata,
  data: unknown,
): Promise<string> {
  await mkdir('data/raw', { recursive: true });
  const filePath = `data/raw/${filename}`;
  await writeFile(filePath, JSON.stringify({ meta: metadata, data }, null, 2));
  return filePath;
}

export async function saveParsedData(
  filename: string,
  metadata: Metadata,
  data: unknown,
): Promise<string> {
  await mkdir('data/parsed', { recursive: true });
  const filePath = `data/parsed/${filename}`;
  await writeFile(filePath, JSON.stringify({ meta: metadata, data }, null, 2));
  return filePath;
}

export function printOrganizationSummary(organizations: Organization[]): void {
  console.log('\n=== Summary ===');
  console.log(`Total: ${organizations.length}`);
  console.log(`With phone: ${organizations.filter((o) => o.phone).length}`);
  console.log(`With website: ${organizations.filter((o) => o.website).length}`);
  console.log(`With email: ${organizations.filter((o) => o.email).length}`);
  console.log(`With telegram: ${organizations.filter((o) => o.telegram).length}`);
  console.log(`With VK: ${organizations.filter((o) => o.vkontakte).length}`);
}

export function parseArgs<T extends string>(
  args: string[],
  defaults: Record<T, string>,
): Record<T, string> {
  const result = { ...defaults };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith('--')) {
      const key = arg.slice(2) as T;
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        result[key] = value;
        i++;
      }
    }
  }

  return result;
}

export function parseViewpoints(args: { lat1: string; lon1: string; lat2: string; lon2: string }): {
  viewpoint1: Point;
  viewpoint2: Point;
} {
  return {
    viewpoint1: { lon: Number(args.lon1), lat: Number(args.lat1) },
    viewpoint2: { lon: Number(args.lon2), lat: Number(args.lat2) },
  };
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extract contact from 2GIS item data
// biome-ignore lint/suspicious/noExplicitAny: 2GIS API responses are untyped
export function findContact(item: any, contactType: string): string | undefined {
  return (
    item.contact_groups
      // biome-ignore lint/suspicious/noExplicitAny: 2GIS API responses are untyped
      ?.find((g: any) => g.contacts?.find((c: any) => c.type === contactType))
      // biome-ignore lint/suspicious/noExplicitAny: 2GIS API responses are untyped
      ?.contacts?.find((c: any) => c.type === contactType)?.value
  );
}

export interface CreateMetadataParams {
  apiVersion: string;
  endpoint: string;
  statusCode: number;
  query: unknown;
  responseTimeMs?: number;
  totalResults?: number;
  enrichedCount?: number;
  searchResponseTimeMs?: number;
  byIdResponseTimeMs?: number;
  totalResponseTimeMs?: number;
}

export function createMetadata(params: CreateMetadataParams): Metadata {
  return {
    fetchedAt: new Date().toISOString(),
    ...params,
  };
}

export function printOrganization(org: Organization): void {
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
}
