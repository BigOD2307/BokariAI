import { describe, expect, it, vi } from 'vitest';
import { envRef, redactConfig, resolveSecrets } from '@/lib/config/secrets';

describe('secret indirection', () => {
  it('resolves env references at read time', () => {
    vi.stubEnv('MY_KEY', 'real-value');
    expect(resolveSecrets({ apiKey: envRef('MY_KEY') })).toEqual({ apiKey: 'real-value' });
  });

  it('resolves a missing variable to an empty string, not undefined', () => {
    expect(resolveSecrets({ apiKey: envRef('NOPE_NOT_SET') })).toEqual({ apiKey: '' });
  });

  it('leaves non-references untouched', () => {
    expect(resolveSecrets({ baseURL: 'https://api.openai.com/v1' })).toEqual({
      baseURL: 'https://api.openai.com/v1',
    });
  });

  it('redacts every secret-looking field', () => {
    expect(redactConfig({ apiKey: 'x', accessToken: 'y', baseURL: 'z', apiKeyEmpty: '' })).toEqual(
      { apiKey: '••••••••', accessToken: '••••••••', baseURL: 'z', apiKeyEmpty: '' },
    );
  });
});
