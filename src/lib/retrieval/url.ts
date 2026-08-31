const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref|ref_src|igshid|xtor|at_)/i;

/** Canonical form used for dedup across providers. Never shown to a user. */
export function canonicalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.protocol = 'https:';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    let out = url.toString();
    if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
    return out;
  } catch {
    return null;
  }
}

export function domainOf(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}
