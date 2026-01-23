import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { API_CONFIG } from './config.js';
import { InvalidListFileError } from './errors.js';
import type { ScrapedOrganization } from './types/index.js';
import type { Logger, Metadata } from './utils.js';
import { createMetadata, slugify } from './utils.js';

export type PublishMode = 'list' | 'full' | 'full-with-reviews';

export interface ListData {
  orgIds: string[];
  query?: string;
  totalResults: number;
}

export class ScraperRepository {
  constructor(private logger: Logger) {}

  private createFileTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  private async saveRawData(
    filename: string,
    metadata: Metadata,
    data: unknown,
    subfolder = '',
  ): Promise<string> {
    const dirPath = subfolder ? `data/raw/${subfolder}` : 'data/raw';
    await mkdir(dirPath, { recursive: true });
    const filePath = `${dirPath}/${filename}`;
    await writeFile(filePath, JSON.stringify({ meta: metadata, data }, null, 2));
    return filePath;
  }

  private async saveParsedData(
    filename: string,
    metadata: Metadata,
    data: unknown,
    subfolder = '',
  ): Promise<string> {
    const dirPath = subfolder ? `data/parsed/${subfolder}` : 'data/parsed';
    await mkdir(dirPath, { recursive: true });
    const filePath = `${dirPath}/${filename}`;
    await writeFile(filePath, JSON.stringify({ meta: metadata, data }, null, 2));
    return filePath;
  }

  async readListFile(filePath: string): Promise<ListData> {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both parsed list data and raw list data
    const data = parsed.data || parsed;

    if (Array.isArray(data)) {
      // Array of organizations
      const orgIds = data
        .map((org) => org.orgId || org.firmId)
        .filter((id): id is string => Boolean(id));

      return {
        orgIds,
        totalResults: orgIds.length,
        query: parsed.meta?.query,
      };
    }

    throw new InvalidListFileError('Invalid list file format', filePath);
  }

  async saveListData(
    query: string,
    responseTimeMs: number,
    organizations: ScrapedOrganization[],
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any[],
  ): Promise<void> {
    const timestamp = this.createFileTimestamp();
    const slug = slugify(query);
    const metadata = this.createMetadata(query, responseTimeMs, organizations.length);

    await this.saveRawData(`list-raw-${slug}-${timestamp}.json`, metadata, rawData, 'list');
    this.logger.success(`List raw data saved (${rawData.length} items)`);

    await this.saveParsedData(`list-${slug}-${timestamp}.json`, metadata, organizations, 'list');
    this.logger.success(`List parsed data saved (${organizations.length} items)`);
  }

  async saveOrganizations(
    query: string,
    responseTimeMs: number,
    organizations: ScrapedOrganization[],
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any[],
    prefix: 'full' | 'full-with-reviews' = 'full',
  ): Promise<void> {
    const timestamp = this.createFileTimestamp();
    const slug = slugify(query);
    const metadata = this.createMetadata(query, responseTimeMs, organizations.length);

    // Save each organization individually
    for (let i = 0; i < organizations.length; i++) {
      const org = organizations[i];
      const raw = rawData[i];
      if (!org || !raw) continue;

      const orgId = org.orgId || `unknown-${i}`;

      // Save raw data
      await this.saveRawData(
        `${orgId}-${timestamp}.json`,
        this.createMetadata(query, responseTimeMs, 1),
        raw,
        `${prefix}/organizations`,
      );

      // Save parsed data
      await this.saveParsedData(
        `${orgId}-${timestamp}.json`,
        this.createMetadata(query, responseTimeMs, 1),
        org,
        `${prefix}/organizations`,
      );
    }

    // Create manifest with list of all orgs
    const manifest = {
      query,
      scrapedAt: new Date().toISOString(),
      totalOrganizations: organizations.length,
      organizationIds: organizations.map((org) => org.orgId || 'unknown'),
      timestamp,
    };

    await this.saveParsedData(
      `${slug}-${timestamp}.json`,
      metadata,
      manifest,
      `${prefix}/manifests`,
    );

    this.logger.success(`Organizations saved: ${organizations.length} individual files + manifest`);
  }

  async saveReviews(
    query: string,
    responseTimeMs: number,
    organizations: ScrapedOrganization[],
  ): Promise<void> {
    const allReviews = organizations.flatMap((org) => {
      if (!org.reviews || org.reviews.length === 0) return [];
      return org.reviews.map((review) => ({
        ...review,
        organizationId: org.orgId,
        organizationName: org.name,
      }));
    });

    if (allReviews.length === 0) return;

    const timestamp = this.createFileTimestamp();
    const slug = slugify(query);
    const metadata = this.createMetadata(query, responseTimeMs, allReviews.length);

    await this.saveParsedData(
      `reviews-${slug}-${timestamp}.json`,
      metadata,
      allReviews,
      'full-with-reviews/reviews',
    );
    this.logger.success(`Reviews data saved (${allReviews.length} reviews)`);
  }

  async saveOrganizationById(
    orgId: string,
    responseTimeMs: number,
    organization: ScrapedOrganization,
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any,
    includeReviews = false,
  ): Promise<void> {
    const timestamp = this.createFileTimestamp();
    const prefix = includeReviews ? 'full-with-reviews' : 'full';
    const metadata = this.createMetadata(orgId, responseTimeMs, 1);

    await this.saveRawData(
      `${prefix}-organization-${orgId}-raw-${timestamp}.json`,
      metadata,
      rawData,
      'organizations',
    );
    this.logger.success(`Organization raw data saved (ID: ${orgId})`);

    await this.saveParsedData(
      `${prefix}-organization-${orgId}-${timestamp}.json`,
      metadata,
      organization,
      'organizations',
    );
    this.logger.success(`Organization parsed data saved (ID: ${orgId})`);

    if (includeReviews && organization.reviews && organization.reviews.length > 0) {
      const reviewsWithOrg = organization.reviews.map((review) => ({
        ...review,
        organizationId: organization.orgId,
        organizationName: organization.name,
      }));

      await this.saveParsedData(
        `organization-${orgId}-reviews-${timestamp}.json`,
        metadata,
        reviewsWithOrg,
        'organizations/reviews',
      );
      this.logger.success(`Organization reviews saved (${reviewsWithOrg.length} reviews)`);
    }
  }

  private createMetadata(query: string, responseTimeMs: number, totalResults: number): Metadata {
    return createMetadata({
      apiVersion: API_CONFIG.version,
      endpoint: API_CONFIG.endpoint,
      statusCode: API_CONFIG.statusCode,
      query,
      totalResults,
      responseTimeMs,
    });
  }

  /**
   * Collect data files for a given publish mode
   */
  async collectDataFiles(mode: PublishMode): Promise<string[]> {
    const basePath = `data/parsed/${mode}`;

    try {
      if (mode === 'list') {
        const files = await readdir(basePath);
        return files.filter((f) => f.endsWith('.json')).map((f) => `${basePath}/${f}`);
      }
      const files = await readdir(`${basePath}/organizations`);
      return files
        .filter((f) => f.endsWith('.json') && !f.includes('manifest'))
        .map((f) => `${basePath}/organizations/${f}`);
    } catch {
      return [];
    }
  }

  /**
   * Read and parse a JSON file
   */
  async readJsonFile(filePath: string): Promise<unknown> {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save dataset file (for HF publishing)
   */
  async saveDatasetFile(filename: string, content: string): Promise<string> {
    const filePath = `data/${filename}`;
    await writeFile(filePath, content);
    return filePath;
  }
}
