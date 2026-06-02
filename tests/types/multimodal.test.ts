import { describe, it, expect } from 'vitest';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_PDF_SIZE_BYTES,
  SUPPORTED_IMAGE_MIMES,
  SUPPORTED_PDF_MIMES,
} from '@/lib/types/multimodal';

describe('multimodal types', () => {
  it('exports 10MB max image size', () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('exports 20MB max pdf size', () => {
    expect(MAX_PDF_SIZE_BYTES).toBe(20 * 1024 * 1024);
  });

  it('supports jpeg/png/webp/gif images', () => {
    expect(SUPPORTED_IMAGE_MIMES).toContain('image/jpeg');
    expect(SUPPORTED_IMAGE_MIMES).toContain('image/png');
    expect(SUPPORTED_IMAGE_MIMES).toContain('image/webp');
    expect(SUPPORTED_IMAGE_MIMES).toContain('image/gif');
  });

  it('supports application/pdf', () => {
    expect(SUPPORTED_PDF_MIMES).toContain('application/pdf');
  });
});
