import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateDatasetCard, getUploadInstructions } from '../src/publisher.js';
import { PublisherRepository } from '../src/repos/index.js';

const testExportsDir = 'data/exports';
const testReviewsFile = `${testExportsDir}/reviews-dataset.jsonl`;

const repository = new PublisherRepository();

describe('publisher', () => {
  beforeEach(() => {
    mkdirSync(testExportsDir, { recursive: true });

    // Create test reviews file
    writeFileSync(
      testReviewsFile,
      '{"text":"Great place!","rating":5}\n{"text":"Not good","rating":2}\n{"text":"Average","rating":3}',
    );
  });

  afterEach(() => {
    // Clean up test files only
    if (existsSync(testReviewsFile)) rmSync(testReviewsFile);
  });

  describe('repository.hasReviewsDataset', () => {
    it('should return true when reviews file exists', async () => {
      expect(await repository.hasReviewsDataset()).toBe(true);
    });
  });

  describe('repository.readReviewsDataset', () => {
    it('should read reviews JSONL content', async () => {
      const content = await repository.readReviewsDataset();
      expect(content).toContain('Great place!');
      expect(content).toContain('Not good');
    });
  });

  describe('generateDatasetCard', () => {
    it('should generate valid markdown', () => {
      const card = generateDatasetCard(
        {
          datasetName: 'test/dataset',
          privateRepo: false,
        },
        {
          totalRecords: 100,
        },
      );

      expect(card).toContain('license: mit');
      expect(card).toContain('test/dataset');
      expect(card).toContain('100');
      expect(card).toContain('text-classification');
    });

    it('should include reviews fields description', () => {
      const card = generateDatasetCard(
        {
          datasetName: 'test/dataset',
          privateRepo: false,
        },
        {
          totalRecords: 50,
        },
      );

      expect(card).toContain('`text`');
      expect(card).toContain('`rating`');
    });

    it('should include size category', () => {
      const card = generateDatasetCard(
        {
          datasetName: 'test/dataset',
          privateRepo: false,
        },
        {
          totalRecords: 5000,
        },
      );

      expect(card).toContain('1K<n<10K');
    });
  });

  describe('getUploadInstructions', () => {
    it('should return uv upload commands', () => {
      const instructions = getUploadInstructions(
        {
          datasetName: 'user/my-dataset',
          privateRepo: false,
        },
        {
          jsonlPath: 'data/hf-dataset-reviews.jsonl',
          readmePath: 'data/hf-README.md',
          stats: { totalRecords: 10 },
        },
      );

      expect(instructions).toContain('uv tool run');
      expect(instructions).toContain('huggingface_hub');
      expect(instructions).toContain('user/my-dataset');
    });

    it('should include upload paths', () => {
      const instructions = getUploadInstructions(
        {
          datasetName: 'user/my-dataset',
          privateRepo: false,
        },
        {
          jsonlPath: 'data/hf-dataset-reviews.jsonl',
          readmePath: 'data/hf-README.md',
          stats: { totalRecords: 10 },
        },
      );

      expect(instructions).toContain('train.jsonl');
      expect(instructions).toContain('README.md');
      expect(instructions).toContain('--repo-type dataset');
    });
  });
});
