/**
 * Secret indirection for provider configs.
 *
 * `data/config.json` lives in a Docker volume, is read by /api/config, and is
 * trivially exfiltrated. It must never hold a real credential. Instead we store
 * the marker `env:VAR_NAME` and resolve it at provider construction time, so the
 * plaintext only ever exists in process memory.
 */
export const ENV_REF_PREFIX = 'env:';

export function isEnvRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENV_REF_PREFIX);
}

export function envRef(varName: string): string {
  return `${ENV_REF_PREFIX}${varName}`;
}

/** Resolve every `env:` marker in a provider config. Missing vars resolve to ''
 *  so the provider fails its own validation rather than throwing here. */
export function resolveSecrets(
  config: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(config ?? {})) {
    out[key] = isEnvRef(value)
      ? (process.env[value.slice(ENV_REF_PREFIX.length)] ?? '')
      : value;
  }
  return out;
}

/** Mask anything secret-looking before it leaves the process. */
export function redactConfig(
  config: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(config ?? {})) {
    const secret = /key|secret|token|password/i.test(key);
    out[key] = secret ? (value ? '••••••••' : '') : value;
  }
  return out;
}
