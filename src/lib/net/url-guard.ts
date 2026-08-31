import dns from 'node:dns/promises';
import net from 'node:net';

/** Hosts a provider `baseURL` may point at, per provider type. Local runtimes
 *  (ollama, lmstudio, lemonade) are opt-in through an env var, because on a
 *  public deployment they are an SSRF primitive, not a feature. */
const ALLOWED_PROVIDER_HOSTS: Record<string, string[]> = {
  openai: ['api.openai.com'],
  openrouter: ['openrouter.ai'],
  groq: ['api.groq.com'],
  anthropic: ['api.anthropic.com'],
  gemini: ['generativelanguage.googleapis.com'],
};

function localRuntimeHosts(): string[] {
  return (process.env.BOKARI_ALLOWED_LOCAL_LLM_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
}

export function assertAllowedProviderBaseURL(type: string, baseURL: string): void {
  const { hostname, protocol } = new URL(baseURL);
  if (protocol !== 'https:' && !localRuntimeHosts().includes(hostname)) {
    throw new Error(`Provider baseURL must be https: ${baseURL}`);
  }
  const allowed = [...(ALLOWED_PROVIDER_HOSTS[type] ?? []), ...localRuntimeHosts()];
  if (!allowed.includes(hostname)) {
    throw new Error(`Provider baseURL host not allowed: ${hostname}`);
  }
}

function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;        // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    return true;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return false;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return false; // ULA
  if (lower.startsWith('fe80')) return false;                          // link-local
  if (lower.startsWith('::ffff:')) return isPublicAddress(lower.slice(7));
  return true;
}

/**
 * Validate a URL that will be fetched on behalf of user-supplied input.
 * Resolves DNS and refuses any private, loopback or link-local target.
 *
 * Note the residual TOCTOU window: DNS could change between this check and the
 * fetch. We accept it because the fetch below uses `redirect: 'manual'` and a
 * hard byte cap, which bounds the damage; closing it fully requires pinning the
 * resolved IP, which `undici` does not expose simply.
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  const records = await dns.lookup(url.hostname, { all: true });
  if (records.length === 0 || !records.every((r) => isPublicAddress(r.address))) {
    throw new Error('URL resolves to a non-public address');
  }
  return url;
}
