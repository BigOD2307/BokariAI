/**
 * @module hooks/useShortcuts.test
 * @description Tests for the keyboard shortcut hook utilities.
 */
import { describe, it, expect, vi } from 'vitest';
import { useShortcuts, useToggleSidebarShortcut, useNewThreadShortcut } from '@/lib/hooks/useShortcuts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('useShortcuts hook', () => {
  it('exports a useShortcuts function', () => {
    expect(typeof useShortcuts).toBe('function');
  });

  it('exports a useToggleSidebarShortcut function', () => {
    expect(typeof useToggleSidebarShortcut).toBe('function');
  });

  it('exports a useNewThreadShortcut function', () => {
    expect(typeof useNewThreadShortcut).toBe('function');
  });
});
