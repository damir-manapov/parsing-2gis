import type { ScrapedOrganization } from './types/index.js';
import type { Logger, Metadata } from './utils.js';
import {
  createFileTimestamp,
  createMetadata,
  saveParsedData,
  saveRawData,
  slugify,
} from './utils.js';

export interface SaveOptions {
  query: string;
  mode: 'list' | 'full' | 'full-with-reviews';
  responseTimeMs: number;
}

export class ScraperRepository {
  constructor(private logger: Logger) {}

  /**
   * Save scraped data with appropriate file names based on mode
   */
  async save(
    options: SaveOptions,
    organizations: ScrapedOrganization[],
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any[],
  ): Promise<void> {
    const timestamp = createFileTimestamp();
    const slug = slugify(options.query);
    const metadata = this.createMetadata(options, organizations.length);

    switch (options.mode) {
      case 'list':
        await this.saveListMode(slug, timestamp, metadata, organizations, rawData);
        break;
      case 'full':
        await this.saveFullMode(slug, timestamp, metadata, organizations, rawData);
        break;
      case 'full-with-reviews':
        await this.saveFullWithReviewsMode(slug, timestamp, metadata, organizations, rawData);
        break;
    }
  }

  private createMetadata(options: SaveOptions, totalResults: number): Metadata {
    return createMetadata({
      apiVersion: 'playwright-scrape',
      endpoint: 'search-scrape',
      statusCode: 200,
      query: options.query,
      totalResults,
      responseTimeMs: options.responseTimeMs,
    });
  }

  private async saveListMode(
    slug: string,
    timestamp: string,
    metadata: Metadata,
    organizations: ScrapedOrganization[],
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any[],
  ): Promise<void> {
    await saveRawData(`list-raw-${slug}-${timestamp}.json`, metadata, rawData);
    this.logger.success(`List raw data saved (${rawData.length} items)`);

    await saveParsedData(`list-${slug}-${timestamp}.json`, metadata, organizations);
    this.logger.success(`List parsed data saved (${organizations.length} items)`);
  }

  private async saveFullMode(
    slug: string,
    timestamp: string,
    metadata: Metadata,
    organizations: ScrapedOrganization[],
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any[],
  ): Promise<void> {
    await saveRawData(`full-organizations-raw-${slug}-${timestamp}.json`, metadata, rawData);
    this.logger.success(`Organizations raw data saved (${rawData.length} items)`);

    await saveParsedData(`full-organizations-${slug}-${timestamp}.json`, metadata, organizations);
    this.logger.success(`Organizations parsed data saved (${organizations.length} items)`);
  }

  private async saveFullWithReviewsMode(
    slug: string,
    timestamp: string,
    metadata: Metadata,
    organizations: ScrapedOrganization[],
    // biome-ignore lint/suspicious/noExplicitAny: Raw 2GIS data structure is dynamic
    rawData: any[],
  ): Promise<void> {
    // Save organizations
    await saveRawData(
      `full-with-reviews-organizations-raw-${slug}-${timestamp}.json`,
      metadata,
      rawData,
    );
    this.logger.success(`Organizations raw data saved (${rawData.length} items)`);

    await saveParsedData(
      `full-with-reviews-organizations-${slug}-${timestamp}.json`,
      metadata,
      organizations,
    );
    this.logger.success(`Organizations parsed data saved (${organizations.length} items)`);

    // Save reviews separately
    await this.saveReviews(slug, timestamp, metadata, organizations);
  }

  private async saveReviews(
    slug: string,
    timestamp: string,
    metadata: Metadata,
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

    if (allReviews.length > 0) {
      await saveParsedData(
        `full-with-reviews-reviews-${slug}-${timestamp}.json`,
        { ...metadata, totalResults: allReviews.length },
        allReviews,
      );
      this.logger.success(`Reviews data saved (${allReviews.length} reviews)`);
    }
  }
}
