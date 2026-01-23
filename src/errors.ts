// Custom error classes for better error handling

export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class NavigationError extends ScraperError {
  constructor(
    message: string,
    public readonly url: string,
    context?: Record<string, unknown>,
  ) {
    super(message, { ...context, url });
    this.name = 'NavigationError';
  }
}

export class DataExtractionError extends ScraperError {
  constructor(
    message: string,
    public readonly orgId?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, { ...context, orgId });
    this.name = 'DataExtractionError';
  }
}

export class InvalidListFileError extends ScraperError {
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(message, { filePath });
    this.name = 'InvalidListFileError';
  }
}

export class ValidationError extends ScraperError {
  constructor(
    message: string,
    public readonly field: string,
    context?: Record<string, unknown>,
  ) {
    super(message, { ...context, field });
    this.name = 'ValidationError';
  }
}
