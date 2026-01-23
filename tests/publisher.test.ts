import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collectDataFiles,
  convertToJSONL,
  generateDatasetCard,
  getUploadInstructions,
} from '../src/publisher.js';

const testListDir = 'data/parsed/list';
const testFullDir = 'data/parsed/full/organizations';
const testListFile = `${testListDir}/test-publisher-list.json`;
const testOrgFile = `${testFullDir}/test-publisher-org.json`;

describe('publisher', () => {
  beforeEach(() => {
    mkdirSync(testListDir, { recursive: true });
    mkdirSync(testFullDir, { recursive: true });

    // Create test list file
    writeFileSync(
      testListFile,
      JSON.stringify({
        data: [
          { name: 'Org 1', orgId: '123' },
          { name: 'Org 2', orgId: '456' },
        ],
      }),
    );

    // Create test org file
    writeFileSync(
      testOrgFile,
      JSON.stringify({
        name: 'Test Org',
        orgId: '789',
        reviews: [{ text: 'Great!' }],
      }),
    );
  });

  afterEach(() => {
    // Clean up test files only
    if (existsSync(testListFile)) rmSync(testListFile);
    if (existsSync(testOrgFile)) rmSync(testOrgFile);
  });

  describe('collectDataFiles', () => {
    it('should collect list files', async () => {
      const files = await collectDataFiles('list');
      expect(files.some((f) => f.includes('test-publisher-list.json'))).toBe(true);
    });

    it('should collect organization files', async () => {
      const files = await collectDataFiles('full');
      expect(files.some((f) => f.includes('test-publisher-org.json'))).toBe(true);
    });

    it('should return empty array for non-existent mode', async () => {
      const files = await collectDataFiles('nonexistent' as 'list');
      expect(files).toEqual([]);
    });
  });

  describe('convertToJSONL', () => {
    it('should convert list files to JSONL', async () => {
      const jsonl = await convertToJSONL([testListFile]);
      const lines = jsonl.split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] ?? '{}')).toEqual({ name: 'Org 1', orgId: '123' });
    });

    it('should convert org files to JSONL', async () => {
      const jsonl = await convertToJSONL([testOrgFile]);
      const lines = jsonl.split('\n');

      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0] ?? '{}')).toHaveProperty('name', 'Test Org');
    });
  });

  describe('generateDatasetCard', () => {
    it('should generate valid markdown', () => {
      const card = generateDatasetCard(
        {
          datasetName: 'test/dataset',
          mode: 'list',
          outputFormat: 'jsonl',
          privateRepo: false,
        },
        {
          totalRecords: 100,
          totalFiles: 5,
        },
      );

      expect(card).toContain('license: mit');
      expect(card).toContain('test/dataset');
      expect(card).toContain('100');
      expect(card).toContain('5');
    });

    it('should include license info', () => {
      const card = generateDatasetCard(
        {
          datasetName: 'test/dataset',
          mode: 'full',
          outputFormat: 'jsonl',
          privateRepo: false,
        },
        {
          totalRecords: 50,
          totalFiles: 2,
        },
      );

      expect(card).toContain('license: mit');
    });
  });

  describe('getUploadInstructions', () => {
    it('should return upload commands', () => {
      const instructions = getUploadInstructions(
        {
          datasetName: 'user/my-dataset',
          mode: 'list',
          outputFormat: 'jsonl',
          privateRepo: false,
        },
        {
          jsonlPath: 'data/hf-dataset/train.jsonl',
          readmePath: 'data/hf-dataset/README.md',
          stats: { totalRecords: 10, totalFiles: 1 },
        },
      );

      expect(instructions).toContain('huggingface-cli');
      expect(instructions).toContain('user/my-dataset');
    });

    it('should include upload paths', () => {
      const instructions = getUploadInstructions(
        {
          datasetName: 'user/my-dataset',
          mode: 'list',
          outputFormat: 'jsonl',
          privateRepo: false,
        },
        {
          jsonlPath: 'data/hf-dataset/train.jsonl',
          readmePath: 'data/hf-dataset/README.md',
          stats: { totalRecords: 10, totalFiles: 1 },
        },
      );

      expect(instructions).toContain('train.jsonl');
      expect(instructions).toContain('README.md');
    });
  });
});
