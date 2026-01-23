import type { ScrapedOrganization } from './types/index.js';
import type { Logger, Metadata } from './utils.js';
import {
  createFileTimestamp,
  createMetadata,
  saveParsedData,
  saveRawData,
  slugify,
} from './utils.js';

export class ScraperRepository {
  constructor(private logger: Logger) {}

  async saveListData(
    query: string,
    responseTimeMs: number,
    organizations: ScrapedOrganization[],
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any[],
  ): Promise<void> {
    const timestamp = createFileTimestamp();
    const slug = slugify(query);
    const metadata = this.createMetadata(query, responseTimeMs, organizations.length);

    await saveRawData(`list-raw-${slug}-${timestamp}.json`, metadata, rawData);
    this.logger.success(`List raw data saved (${rawData.length} items)`);

    await saveParsedData(`list-${slug}-${timestamp}.json`, metadata, organizations);
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
    const timestamp = createFileTimestamp();
    const slug = slugify(query);
    const metadata = this.createMetadata(query, responseTimeMs, organizations.length);

    await saveRawData(`${prefix}-organizations-raw-${slug}-${timestamp}.json`, metadata, rawData);
    this.logger.success(`Organizations raw data saved (${rawData.length} items)`);

    await saveParsedData(
      `${prefix}-organizations-${slug}-${timestamp}.json`,
      metadata,
      organizations,
    );
    this.logger.success(`Organizations parsed data saved (${organizations.length} items)`);
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

    const timestamp = createFileTimestamp();
    const slug = slugify(query);
    const metadata = this.createMetadata(query, responseTimeMs, allReviews.length);

    await saveParsedData(
      `full-with-reviews-reviews-${slug}-${timestamp}.json`,
      metadata,
      allReviews,
    );
    this.logger.success(`Reviews data saved (${allReviews.length} reviews)`);
  }

  private createMetadata(query: string, responseTimeMs: number, totalResults: number): Metadata {
    return createMetadata({
      apiVersion: 'playwright-scrape',
      endpoint: 'search-scrape',
      statusCode: 200,
      query,
      totalResults,
      responseTimeMs,
    });
  }
}
