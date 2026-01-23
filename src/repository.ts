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

    await saveRawData(`list-raw-${slug}-${timestamp}.json`, metadata, rawData, 'list');
    this.logger.success(`List raw data saved (${rawData.length} items)`);

    await saveParsedData(`list-${slug}-${timestamp}.json`, metadata, organizations, 'list');
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

    await saveRawData(
      `${prefix}-organizations-raw-${slug}-${timestamp}.json`,
      metadata,
      rawData,
      prefix,
    );
    this.logger.success(`Organizations raw data saved (${rawData.length} items)`);

    await saveParsedData(
      `${prefix}-organizations-${slug}-${timestamp}.json`,
      metadata,
      organizations,
      prefix,
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
    const timestamp = createFileTimestamp();
    const prefix = includeReviews ? 'full-with-reviews' : 'full';
    const metadata = this.createMetadata(orgId, responseTimeMs, 1);

    await saveRawData(
      `${prefix}-organization-${orgId}-raw-${timestamp}.json`,
      metadata,
      rawData,
      'organizations',
    );
    this.logger.success(`Organization raw data saved (ID: ${orgId})`);

    await saveParsedData(
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

      await saveParsedData(
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
      apiVersion: 'playwright-scrape',
      endpoint: 'search-scrape',
      statusCode: 200,
      query,
      totalResults,
      responseTimeMs,
    });
  }
}
