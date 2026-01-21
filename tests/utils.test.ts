import { describe, expect, it } from 'vitest';
import { findContact, slugify } from '../src/utils.js';

describe('utils', () => {
  describe('slugify', () => {
    it('should convert text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Café & Restaurant')).toBe('caf-restaurant');
      expect(slugify('Кальян бар')).toBe('-');
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
      expect(findContact(item, 'email')).toBe('test@example.com');
      expect(findContact(item, 'website')).toBeUndefined();
    });

    it('should handle missing contact groups', () => {
      const item = {};
      expect(findContact(item, 'phone')).toBeUndefined();
    });
  });
});
