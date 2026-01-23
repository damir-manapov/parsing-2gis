// Custom error classes for better error handling

export class InvalidListFileError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(message);
    this.name = 'InvalidListFileError';
  }
}
