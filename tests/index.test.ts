import { describe, expect, it } from 'vitest';
import { buildSearchUrl, parseItem } from '../src/api.js';
import type { ApiItem } from '../src/types.js';

describe('buildSearchUrl', () => {
  it('should build valid search URL', () => {
    const url = buildSearchUrl({
      query: 'кальян',
      viewpoint1: { lon: 37.556366, lat: 55.926069 },
      viewpoint2: { lon: 37.683974, lat: 55.581373 },
    });

    expect(url).toContain('catalog.api.2gis.ru/3.0/items');
    expect(url).toContain('q=%D0%BA%D0%B0%D0%BB%D1%8C%D1%8F%D0%BD');
    expect(url).toContain('viewpoint1=37.556366');
    expect(url).toContain('viewpoint2=37.683974');
  });

  it('should use fixed page size of 12', () => {
    const url = buildSearchUrl({
      query: 'test',
      viewpoint1: { lon: 37.5, lat: 55.9 },
      viewpoint2: { lon: 37.6, lat: 55.5 },
    });

    // API requires page_size=12 (fixed, not configurable)
    expect(url).toContain('page_size=12');
  });
});

describe('parseItem', () => {
  it('should parse organization from API item', () => {
    const item: ApiItem = {
      id: '123',
      type: 'branch',
      name: 'Test Organization',
      address_name: 'Test Street, 1',
      address_comment: '1st floor',
      point: { lat: 55.75, lon: 37.62 },
      adm_div: [
        { id: '1', name: 'Moscow', type: 'city' },
        { id: '2', name: 'Central', type: 'district' },
      ],
      org: {
        id: 'org-1',
        name: 'Test Org',
        branch_count: 5,
      },
      rubrics: [
        { id: 'r1', name: 'Restaurant', kind: 'primary' },
        { id: 'r2', name: 'Bar', kind: 'additional' },
      ],
      reviews: {
        general_rating: 4.5,
        general_review_count: 100,
      },
      schedule: {
        Mon: { working_hours: [{ from: '09:00', to: '18:00' }] },
        Tue: { working_hours: [{ from: '09:00', to: '18:00' }] },
      },
    };

    const org = parseItem(item);

    expect(org.id).toBe('123');
    expect(org.name).toBe('Test Organization');
    expect(org.address).toBe('Test Street, 1');
    expect(org.addressComment).toBe('1st floor');
    expect(org.city).toBe('Moscow');
    expect(org.district).toBe('Central');
    expect(org.point).toEqual({ lat: 55.75, lon: 37.62 });
    expect(org.orgId).toBe('org-1');
    expect(org.orgName).toBe('Test Org');
    expect(org.orgBranchCount).toBe(5);
    expect(org.rating).toBe(4.5);
    expect(org.reviewCount).toBe(100);
    expect(org.rubrics).toHaveLength(2);
    expect(org.schedule?.Mon).toEqual([{ from: '09:00', to: '18:00' }]);
  });

  it('should handle missing optional fields', () => {
    const item: ApiItem = {
      id: '456',
      type: 'branch',
      name: 'Minimal Org',
    };

    const org = parseItem(item);

    expect(org.id).toBe('456');
    expect(org.name).toBe('Minimal Org');
    expect(org.address).toBe('');
    expect(org.point).toEqual({ lat: 0, lon: 0 });
    expect(org.rubrics).toEqual([]);
    expect(org.rating).toBeUndefined();
  });
});
