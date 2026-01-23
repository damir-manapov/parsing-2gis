import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectReviews, exportReviews, exportToCSV, exportToJSONL } from '../src/exporter.js';

describe('exporter', () => {
  const testDir = 'data/test-reviews';
  const testOutputDir = 'data/test-exports';

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(testOutputDir, { recursive: true });

    const testReviewFile = {
      metadata: { timestamp: '2026-01-23T12:00:00.000Z' },
      data: [
        { text: 'Great place!', rating: 5 },
        { text: 'Not bad', rating: 4 },
        { text: 'Terrible', rating: 1 },
      ],
    };

    writeFileSync(`${testDir}/test-reviews.json`, JSON.stringify(testReviewFile));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
  });

  describe('exportToJSONL', () => {
    it('should convert reviews to JSONL format', () => {
      const reviews = [
        { text: 'Great!', rating: 5 },
        { text: 'OK', rating: 3 },
      ];

      const result = exportToJSONL(reviews);
      const lines = result.split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] ?? '')).toEqual({ text: 'Great!', rating: 5 });
      expect(JSON.parse(lines[1] ?? '')).toEqual({ text: 'OK', rating: 3 });
    });
  });

  describe('exportToCSV', () => {
    it('should convert reviews to CSV format with header', () => {
      const reviews = [
        { text: 'Great place!', rating: 5 },
        { text: 'Not good', rating: 2 },
      ];

      const result = exportToCSV(reviews);
      const lines = result.split('\n');

      expect(lines[0]).toBe('rating,text');
      expect(lines[1]).toBe('5,"Great place!"');
      expect(lines[2]).toBe('2,"Not good"');
    });

    it('should escape quotes in text', () => {
      const reviews = [{ text: 'Said "hello"', rating: 5 }];

      const result = exportToCSV(reviews);

      expect(result).toContain('Said ""hello""');
    });
  });

  describe('collectReviews', () => {
    it('should collect reviews from directory', () => {
      const reviews = collectReviews(testDir);

      expect(reviews).toHaveLength(3);
      expect(reviews[0]).toEqual({ text: 'Great place!', rating: 5 });
    });

    it('should throw error if directory does not exist', () => {
      expect(() => collectReviews('nonexistent-dir')).toThrow('Reviews directory not found');
    });
  });

  describe('exportReviews', () => {
    it('should export reviews to JSONL file', () => {
      const result = exportReviews(testOutputDir, 'jsonl', testDir);

      expect(result.reviews).toHaveLength(3);
      expect(result.format).toBe('jsonl');
      expect(result.outputPath).toContain('reviews-dataset.jsonl');
      expect(existsSync(result.outputPath)).toBe(true);
    });

    it('should export reviews to CSV file', () => {
      const result = exportReviews(testOutputDir, 'csv', testDir);

      expect(result.format).toBe('csv');
      expect(result.outputPath).toContain('reviews-dataset.csv');
      expect(existsSync(result.outputPath)).toBe(true);
    });
  });
});
