// Configuration constants for the scraper

export const DEFAULT_DELAYS = {
  betweenRequests: 2000,
  retryBackoff: 1000,
} as const;

export const DEFAULT_LIMITS = {
  maxRecords: 50,
  maxRetries: 3,
  maxReviewsPerOrg: 100,
} as const;

export const TIMEOUTS = {
  navigation: 30000,
  wait: 60000,
  reviewPagination: 10000,
} as const;

export const BROWSER_CONFIG = {
  headless: true,
  viewport: { width: 1920, height: 1080 },
} as const;

export const REQUEST_BLOCKING = {
  resourceTypes: ['image', 'font', 'media', 'stylesheet'] as const,
  domains: [
    'google-analytics',
    'googletagmanager',
    'yandex.ru/metrika',
    'mc.yandex.ru',
    'doubleclick.net',
    '/ads/',
    '/metrics/',
  ] as const,
} as const;

export const DATA_PATHS = {
  raw: 'data/raw',
  parsed: 'data/parsed',
} as const;

export const SCRAPING_MODES = {
  LIST: 'list',
  FULL: 'full',
  FULL_WITH_REVIEWS: 'full-with-reviews',
} as const;

export const API_CONFIG = {
  version: 'playwright-scrape',
  endpoint: 'search-scrape',
  statusCode: 200,
} as const;
