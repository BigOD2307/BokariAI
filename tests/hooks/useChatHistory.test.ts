/**
 * @module hooks/useChatHistory.test
 * @description Smoke tests for the paginated chat history hook.
 */
import { describe, it, expect, vi } from 'vitest';
import { useChatHistory } from '@/lib/hooks/useChatHistory';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('useChatHistory hook', () => {
  it('exports a function', () => {
    expect(typeof useChatHistory).toBe('function');
  });
});
