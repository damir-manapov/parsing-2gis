/**
 * Shared constants for repository operations
 */

export const DATA_PATHS = {
  raw: 'data/raw',
  parsed: 'data/parsed',
  exports: 'data/exports',
} as const;

export const REVIEWS_PATHS = {
  dir: 'data/parsed/full-with-reviews/reviews',
  export: 'data/exports/reviews-dataset.jsonl',
} as const;

export const ORGANIZATIONS_PATHS = {
  full: 'data/parsed/full/organizations',
  fullWithReviews: 'data/parsed/full-with-reviews/organizations',
} as const;
