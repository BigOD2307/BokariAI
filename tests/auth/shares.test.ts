import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateShareId, generateShareSlug } from '@/lib/auth/shares';

describe('shares/id', () => {
  it('generates a share id with the shr_ prefix', () => {
    const id = generateShareId();
    expect(id).toMatch(/^shr_[a-z0-9]{10}$/);
  });

  it('generates two different ids in a row', () => {
    const a = generateShareId();
    const b = generateShareId();
    expect(a).not.toBe(b);
  });

  it('generates a slug with 10 lowercase alphanumerics', () => {
    const slug = generateShareSlug();
    expect(slug).toMatch(/^[a-z0-9]{10}$/);
  });

  it('generates slugs with only the expected alphabet', () => {
    for (let i = 0; i < 20; i += 1) {
      const slug = generateShareSlug();
      expect(slug).toMatch(/^[a-z0-9]{10}$/);
    }
  });
});
