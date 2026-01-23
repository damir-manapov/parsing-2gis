import { mkdir, rm, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScraperRepository } from '../src/repository.js';
import { Logger } from '../src/utils.js';

describe('ScraperRepository', () => {
  const testDataDir = 'data-test';
  let repository: ScraperRepository;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
    repository = new ScraperRepository(logger);
  });

  afterEach(async () => {
    // Cleanup test data
    try {
      await rm(testDataDir, { recursive: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('readListFile', () => {
    it('should read and parse a list file with org IDs', async () => {
      // Setup: Create a test list file
      const listPath = `${testDataDir}/test-list.json`;
      await mkdir(testDataDir, { recursive: true });

      const listData = {
        meta: {
          query: 'test query',
          totalResults: 3,
        },
        data: [
          { orgId: '123', name: 'Org 1' },
          { orgId: '456', name: 'Org 2' },
          { orgId: '789', name: 'Org 3' },
        ],
      };

      await writeFile(listPath, JSON.stringify(listData, null, 2));

      // Test
      const result = await repository.readListFile(listPath);

      // Assert
      expect(result.orgIds).toEqual(['123', '456', '789']);
      expect(result.query).toBe('test query');
      expect(result.totalResults).toBe(3);
    });

    it('should handle list files without meta.query', async () => {
      const listPath = `${testDataDir}/test-list-no-query.json`;
      await mkdir(testDataDir, { recursive: true });

      const listData = {
        data: [
          { orgId: '111', name: 'Org A' },
          { orgId: '222', name: 'Org B' },
        ],
      };

      await writeFile(listPath, JSON.stringify(listData, null, 2));

      const result = await repository.readListFile(listPath);

      expect(result.orgIds).toEqual(['111', '222']);
      expect(result.query).toBeUndefined();
      expect(result.totalResults).toBe(2);
    });

    it('should handle firmId as fallback for orgId', async () => {
      const listPath = `${testDataDir}/test-list-firmid.json`;
      await mkdir(testDataDir, { recursive: true });

      const listData = {
        data: [
          { firmId: '999', name: 'Firm 1' },
          { orgId: '888', name: 'Org 2' },
        ],
      };

      await writeFile(listPath, JSON.stringify(listData, null, 2));

      const result = await repository.readListFile(listPath);

      expect(result.orgIds).toEqual(['999', '888']);
    });

    it('should throw error for invalid list file format', async () => {
      const listPath = `${testDataDir}/test-invalid.json`;
      await mkdir(testDataDir, { recursive: true });

      await writeFile(listPath, JSON.stringify({ invalid: 'format' }, null, 2));

      await expect(repository.readListFile(listPath)).rejects.toThrow('Invalid list file format');
    });
  });

  describe('createMetadata', () => {
    it('should create metadata with all required fields', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const metadata = (repository as any).createMetadata('test-query', 1234, 10);

      expect(metadata).toMatchObject({
        apiVersion: 'playwright-scrape',
        endpoint: 'search-scrape',
        statusCode: 200,
        query: 'test-query',
        totalResults: 10,
        responseTimeMs: 1234,
      });
      expect(metadata.fetchedAt).toBeDefined();
      expect(typeof metadata.fetchedAt).toBe('string');
    });
  });

  describe('data persistence', () => {
    it('should create timestamp in correct format', () => {
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method
      const timestamp = (repository as any).createFileTimestamp();

      // Timestamp should match ISO format with colons/dots replaced by dashes
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
    });
  });
});
