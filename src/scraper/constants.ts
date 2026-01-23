// Re-export configuration from centralized config module
export { TIMEOUTS } from '../config.js';

// Backward compatibility aliases
export const DEFAULT_NAVIGATION_TIMEOUT = 30000;
export const DEFAULT_WAIT_TIMEOUT = 60000;
export const REVIEW_PAGINATION_TIMEOUT = 10000;
