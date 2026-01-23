/**
 * Repository for scraping operations - saving scraped data
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { API_CONFIG } from '../config.js';
import { InvalidListFileError } from '../errors.js';
import type { ScrapedOrganization } from '../types/index.js';
import type { Logger, Metadata } from '../utils.js';
import { createMetadata, slugify } from '../utils.js';
import { DATA_PATHS, ORGANIZATIONS_PATHS } from './constants.js';

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
    const dirPath = subfolder ? `${DATA_PATHS.raw}/${subfolder}` : DATA_PATHS.raw;
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
    const dirPath = subfolder ? `${DATA_PATHS.parsed}/${subfolder}` : DATA_PATHS.parsed;
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

  async getScrapedOrgIds(mode: 'full' | 'full-with-reviews'): Promise<Set<string>> {
    const dirPath =
      mode === 'full' ? ORGANIZATIONS_PATHS.full : ORGANIZATIONS_PATHS.fullWithReviews;
    try {
      const files = await readdir(dirPath);
      const orgIds = new Set<string>();
      for (const file of files) {
        // Extract orgId from filename pattern: {orgId}-{timestamp}.json
        const match = file.match(/^(\d+)-\d{4}-\d{2}-\d{2}T/);
        if (match?.[1]) {
          orgIds.add(match[1]);
        }
      }
      return orgIds;
    } catch {
      // Directory doesn't exist yet
      return new Set();
    }
  }
}
