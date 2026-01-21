import { mkdir, writeFile } from 'node:fs/promises';

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
