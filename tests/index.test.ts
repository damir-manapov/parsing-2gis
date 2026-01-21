import { describe, expect, it } from 'vitest';
import { greet } from '../src/index.js';

describe('greet', () => {
  it('should return greeting message', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
