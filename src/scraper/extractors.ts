import type { Coordinates, MetroStation } from '../types/index.js';
import type { Logger } from '../utils.js';

// biome-ignore lint/suspicious/noExplicitAny: 2GIS data structure is dynamic
export function extractAddressDetails(item: any, logger: Logger) {
  const result = {
    address: '',
    addressComment: undefined as string | undefined,
    postcode: undefined as string | undefined,
    city: undefined as string | undefined,
    district: undefined as string | undefined,
    region: undefined as string | undefined,
    country: undefined as string | undefined,
  };

  try {
    result.address = item.address_name ?? '';
    result.addressComment = item.address_comment;

    if (item.address) {
      const addr = item.address;
      result.postcode = addr.postcode;

      // Extract address components
      if (addr.components) {
        for (const component of addr.components) {
          switch (component.type) {
            case 'city':
              result.city = component.name;
              break;
            case 'district':
              result.district = component.name;
              break;
            case 'region':
              result.region = component.name;
              break;
            case 'country':
              result.country = component.name;
              break;
          }
        }
      }
    }
  } catch (e) {
    logger.warn(`Failed to extract address details: ${e}`);
  }

  return result;
}

// biome-ignore lint/suspicious/noExplicitAny: 2GIS data structure is dynamic
export function extractCoordinates(item: any, logger: Logger): Coordinates | undefined {
  try {
    if (item.point?.lat && item.point?.lon) {
      return {
        lat: item.point.lat,
        lon: item.point.lon,
      };
    }
  } catch (e) {
    logger.debug(`Failed to extract coordinates: ${e}`);
  }
  return undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: 2GIS data structure is dynamic
export function extractMetroStations(item: any, logger: Logger): MetroStation[] | undefined {
  try {
    if (item.links?.nearest_stations && Array.isArray(item.links.nearest_stations)) {
      const stations = item.links.nearest_stations
        .slice(0, 3) // Top 3 closest
        // biome-ignore lint/suspicious/noExplicitAny: Station data from 2GIS
        .map((station: any) => ({
          name: station.name,
          distance: station.distance,
          line: station.comment,
          color: station.color,
        }))
        // biome-ignore lint/suspicious/noExplicitAny: Filtering stations
        .filter((s: any) => s.name);

      return stations.length > 0 ? stations : undefined;
    }
  } catch (e) {
    logger.debug(`Failed to extract metro stations: ${e}`);
  }
  return undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: 2GIS data structure is dynamic
export function extractReviewSummary(item: any, logger: Logger) {
  try {
    if (item.reviews) {
      // biome-ignore lint/suspicious/noExplicitAny: Review summary structure
      const summary: any = {
        rating: item.reviews.rating || 0,
        reviewCount: item.reviews.review_count || 0,
        generalRating: item.reviews.general_rating,
        generalReviewCount: item.reviews.general_review_count,
        orgRating: item.reviews.org_rating,
        orgReviewCount: item.reviews.org_review_count,
        // biome-ignore lint/suspicious/noExplicitAny: Source data from 2GIS
        sources: item.reviews.items?.map((source: any) => ({
          tag: source.tag,
          rating: source.rating,
          reviewCount: source.review_count,
        })),
      };
      return summary;
    }
  } catch (e) {
    logger.debug(`Failed to extract review summary: ${e}`);
  }
  return undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: 2GIS data structure is dynamic
export function extractRating(item: any): number | undefined {
  return item.reviews?.rating || item.rating || undefined;
}
