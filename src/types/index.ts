export interface MetroStation {
  name: string;
  distance: number;
  line?: string;
  color?: string;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Review {
  id: string;
  text: string;
  rating: number;
  dateCreated: string;
  dateEdited?: string;
  author?: string;
  authorId?: string;
  commentsCount?: number;
  source?: string;
  likes?: number;
  dislikes?: number;
}

export interface ScrapedOrganization {
  name: string;
  description?: string;
  address: string;
  addressComment?: string;
  postcode?: string;
  city?: string;
  district?: string;
  region?: string;
  country?: string;
  timezone?: string;
  phone?: string;
  email?: string;
  website?: string;
  schedule?: string;
  rating?: number;
  reviewCount?: number;
  rubrics: string[];
  // Review summary
  reviewSummary?: {
    rating: number;
    reviewCount: number;
    generalRating?: number;
    generalReviewCount?: number;
    orgRating?: number;
    orgReviewCount?: number;
    sources?: Array<{
      tag: string;
      rating?: number;
      reviewCount?: number;
    }>;
  };
  type?: string;
  // Additional fields
  coordinates?: Coordinates;
  nearestMetro?: MetroStation[];
  paymentMethods?: string[];
  features?: string[];
  orgName?: string;
  orgId?: string;
  branchCount?: number;
  photoCount?: number;
  hasPhotos?: boolean;
  createdAt?: string;
  updatedAt?: string;
  reviews?: Review[];
}

export type ScrapingMode = 'list' | 'full' | 'full-with-reviews';

export interface ScraperOptions {
  query?: string;
  orgId?: string;
  delayMs: number;
  maxRecords: number;
  maxRetries: number;
  headless: boolean;
  scrapingMode: ScrapingMode;
  maxReviewsPerOrg: number;
}

export interface DataExtractionResult {
  // biome-ignore lint/suspicious/noExplicitAny: 2GIS data structure is dynamic
  item: any;
  source: 'api' | 'initialState';
  // biome-ignore lint/suspicious/noExplicitAny: Store raw API/initialState response
  fullData?: any;
}
