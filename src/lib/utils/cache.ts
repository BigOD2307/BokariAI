/**
 * Tiny LRU + TTL cache. No external dependency, ~70 lines.
 *
 * - `max`: maximum number of entries (oldest is evicted past this)
 * - `ttlMs`: time-to-live in milliseconds (entries expire on read)
 *
 * Used by /api/discover to bound the in-memory news cache.
 */

type Entry<V> = { value: V; expires: number };

export class TTLCache<K, V> {
  private store = new Map<K, Entry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly max: number,
    private readonly ttlMs: number,
  ) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expires < Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    const entry: Entry<V> = { value, expires: Date.now() + this.ttlMs };
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, entry);
    if (this.store.size > this.max) {
      // Evict oldest (first inserted — Map preserves insertion order)
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
  }

  has(key: K): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expires < Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }
}

/**
 * In-flight de-dupe: collapses concurrent identical requests to one promise.
 * Used to avoid stampeding the search engines when many users hit
 * /api/discover for the same topic at the same time.
 */
export class InflightDedup<V> {
  private inflight = new Map<string, Promise<V>>();

  run(key: string, fn: () => Promise<V>): Promise<V> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }
}
