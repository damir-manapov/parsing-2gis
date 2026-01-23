import type { ScrapedOrganization } from '../types/index.js';
import type { Logger } from '../utils.js';
import { findContact } from '../utils.js';
import {
  extractAddressDetails,
  extractCoordinates,
  extractMetroStations,
  extractReviewSummary,
} from './extractors.js';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Comprehensive data extraction
// biome-ignore lint/suspicious/noExplicitAny: 2GIS data structure is dynamic
export function extractOrganization(item: any, logger: Logger): ScrapedOrganization {
  try {
    // Extract contacts with error handling
    const phone = findContact(item, 'phone');
    const email = findContact(item, 'email');
    const website = findContact(item, 'website');

    // Extract name and description
    let name = '';
    let description: string | undefined;

    try {
      if (item.name_ex) {
        name = item.name_ex.primary ?? item.name ?? '';
        description = item.name_ex.extension;
      } else {
        name = item.name ?? '';
      }
    } catch (e) {
      name = item.name ?? 'Unknown';
      logger.warn(`Failed to extract name: ${e}`);
    }

    // Extract address hierarchy
    const addressDetails = extractAddressDetails(item, logger);
    const { address, addressComment, postcode, city, district, region, country } = addressDetails;

    // Extract schedule
    let schedule: string | undefined;
    try {
      if (item.schedule?.working_hours) {
        const hours = item.schedule.working_hours;
        if (Array.isArray(hours) && hours.length > 0) {
          schedule = hours
            // biome-ignore lint/suspicious/noExplicitAny: Schedule data from 2GIS
            .map((h: any) => `${h.day}: ${h.working_hours?.join(', ') ?? 'closed'}`)
            .join('; ');
        } else if (typeof hours === 'string') {
          schedule = hours;
        }
      }
    } catch (e) {
      logger.debug(`Failed to extract schedule: ${e}`);
    }

    // Extract reviews with validation
    let rating: number | undefined;
    let reviewCount: number | undefined;
    try {
      if (item.reviews) {
        rating = typeof item.reviews.rating === 'number' ? item.reviews.rating : undefined;
        reviewCount =
          typeof item.reviews.general_rating_count === 'number'
            ? item.reviews.general_rating_count
            : undefined;
      }
    } catch (e) {
      logger.debug(`Failed to extract reviews: ${e}`);
    }

    // Extract rubrics with error handling
    let rubrics: string[] = [];
    try {
      if (Array.isArray(item.rubrics)) {
        // biome-ignore lint/suspicious/noExplicitAny: Rubrics data from 2GIS
        rubrics = item.rubrics.map((r: any) => r.name).filter((n: any) => typeof n === 'string');
      }
    } catch (e) {
      logger.warn(`Failed to extract rubrics: ${e}`);
    }

    // Extract coordinates
    const coordinates = extractCoordinates(item, logger);

    // Extract review summary
    const reviewSummary = extractReviewSummary(item, logger);

    // Extract nearest metro stations
    const nearestMetro = extractMetroStations(item, logger);

    // Extract payment methods and features
    let paymentMethods: string[] | undefined;
    let features: string[] | undefined;
    try {
      if (item.attribute_groups && Array.isArray(item.attribute_groups)) {
        const payments: string[] = [];
        const feats: string[] = [];

        for (const group of item.attribute_groups) {
          if (group.name === 'Способы оплаты' && Array.isArray(group.attributes)) {
            // biome-ignore lint/suspicious/noExplicitAny: Attribute data from 2GIS
            payments.push(...group.attributes.map((a: any) => a.name).filter(Boolean));
          } else if (Array.isArray(group.attributes)) {
            // biome-ignore lint/suspicious/noExplicitAny: Attribute data from 2GIS
            feats.push(...group.attributes.map((a: any) => a.name).filter(Boolean));
          }
        }

        if (payments.length > 0) paymentMethods = payments;
        if (feats.length > 0) features = feats;
      }
    } catch (e) {
      logger.debug(`Failed to extract attributes: ${e}`);
    }

    // Extract organization info
    let orgName: string | undefined;
    let orgId: string | undefined;
    let branchCount: number | undefined;
    try {
      if (item.org) {
        orgName = item.org.name || item.org.primary;
        orgId = item.org.id;
        branchCount = typeof item.org.branch_count === 'number' ? item.org.branch_count : undefined;
      }
    } catch (e) {
      logger.debug(`Failed to extract org info: ${e}`);
    }

    // Extract photo info
    let photoCount: number | undefined;
    let hasPhotos: boolean | undefined;
    try {
      if (item.external_content && Array.isArray(item.external_content)) {
        photoCount = item.external_content
          // biome-ignore lint/suspicious/noExplicitAny: Photo content data from 2GIS
          .filter((c: any) => c.type === 'photo_album')
          // biome-ignore lint/suspicious/noExplicitAny: Photo count aggregation
          .reduce((sum: number, c: any) => sum + (c.count || 0), 0);

        if (photoCount === 0) photoCount = undefined;
      }

      if (item.flags?.photos) {
        hasPhotos = true;
      }
    } catch (e) {
      logger.debug(`Failed to extract photo info: ${e}`);
    }

    // Extract timestamps
    let createdAt: string | undefined;
    let updatedAt: string | undefined;
    try {
      if (item.dates) {
        createdAt = item.dates.created_at;
        updatedAt = item.dates.updated_at;
      }
    } catch (e) {
      logger.debug(`Failed to extract dates: ${e}`);
    }

    return {
      name,
      ...(description && { description }),
      address,
      ...(addressComment && { addressComment }),
      ...(postcode && { postcode }),
      ...(city && { city }),
      ...(district && { district }),
      ...(region && { region }),
      ...(country && { country }),
      ...(item.timezone && { timezone: item.timezone }),
      ...(phone && { phone }),
      ...(email && { email }),
      ...(website && { website }),
      ...(schedule && { schedule }),
      ...(rating !== undefined && { rating }),
      ...(reviewCount !== undefined && { reviewCount }),
      rubrics,
      ...(reviewSummary && { reviewSummary }),
      ...(item.type && { type: item.type }),
      ...(coordinates && { coordinates }),
      ...(nearestMetro && { nearestMetro }),
      ...(paymentMethods && { paymentMethods }),
      ...(features && { features }),
      ...(orgName && { orgName }),
      ...(orgId && { orgId }),
      ...(branchCount !== undefined && { branchCount }),
      ...(photoCount !== undefined && { photoCount }),
      ...(hasPhotos !== undefined && { hasPhotos }),
      ...(createdAt && { createdAt }),
      ...(updatedAt && { updatedAt }),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to extract organization data: ${errorMsg}`);

    // Return minimal valid object
    return {
      name: item?.name ?? 'Unknown',
      address: item?.address_name ?? '',
      rubrics: [],
    };
  }
}
