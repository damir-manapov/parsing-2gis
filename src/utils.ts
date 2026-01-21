import { mkdir, writeFile } from 'node:fs/promises';
import type { Organization } from './types.js';

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
