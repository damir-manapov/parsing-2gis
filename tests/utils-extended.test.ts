import { describe, expect, it } from 'vitest';
import { findContact, parseArgs, slugify } from '../src/utils.js';

describe('utils', () => {
  describe('slugify', () => {
    it('should convert text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should handle Cyrillic characters by removing them', () => {
      // slugify only keeps a-z0-9, Cyrillic is removed
      expect(slugify('Кальян Москва')).toBe('-');
    });

    it('should remove special characters', () => {
      expect(slugify('Test!@#$%^&*()123')).toBe('test-123');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Multiple   Spaces   Here')).toBe('multiple-spaces-here');
    });

    it('should handle leading/trailing spaces', () => {
      // Leading/trailing spaces become dashes in current implementation
      expect(slugify('  trim me  ')).toBe('-trim-me-');
    });
  });

  describe('findContact', () => {
    it('should extract phone contact', () => {
      const item = {
        contact_groups: [
          {
            contacts: [
              { type: 'phone', value: '+79991234567' },
              { type: 'email', value: 'test@example.com' },
            ],
          },
        ],
      };
      expect(findContact(item, 'phone')).toBe('+79991234567');
    });

    it('should extract email contact', () => {
      const item = {
        contact_groups: [
          {
            contacts: [
              { type: 'phone', value: '+79991234567' },
              { type: 'email', value: 'test@example.com' },
            ],
          },
        ],
      };
      expect(findContact(item, 'email')).toBe('test@example.com');
    });

    it('should handle missing contact groups', () => {
      expect(findContact({}, 'phone')).toBeUndefined();
    });

    it('should handle empty contact groups', () => {
      const item = { contact_groups: [] };
      expect(findContact(item, 'phone')).toBeUndefined();
    });

    it('should return undefined for non-existent contact type', () => {
      const item = {
        contact_groups: [
          {
            contacts: [{ type: 'phone', value: '+79991234567' }],
          },
        ],
      };
      expect(findContact(item, 'website')).toBeUndefined();
    });
  });

  describe('parseArgs', () => {
    it('should parse command line arguments', () => {
      const args = ['--query', 'test', '--max-records', '10'];
      const result = parseArgs(args, { query: 'default', 'max-records': '50' });

      expect(result.query).toBe('test');
      expect(result['max-records']).toBe('10');
    });

    it('should use defaults for missing arguments', () => {
      const args: string[] = [];
      const result = parseArgs(args, { query: 'default', mode: 'full' });

      expect(result.query).toBe('default');
      expect(result.mode).toBe('full');
    });

    it('should handle arguments without values', () => {
      const args = ['--query'];
      const result = parseArgs(args, { query: 'default' });

      expect(result.query).toBe('default');
    });

    it('should ignore arguments starting with --', () => {
      const args = ['--query', '--another-flag'];
      const result = parseArgs(args, { query: 'default' });

      expect(result.query).toBe('default');
    });

    it('should handle multiple arguments', () => {
      const args = ['--mode', 'list', '--query', 'кальян', '--max-records', '100'];
      const result = parseArgs(args, {
        mode: 'full',
        query: 'default',
        'max-records': '50',
      });

      expect(result.mode).toBe('list');
      expect(result.query).toBe('кальян');
      expect(result['max-records']).toBe('100');
    });
  });
});
