import type { RedisCacheClient } from './types.js';

/** In-memory fallback when Redis is disabled or unavailable at startup. */
export class MemoryCacheClient implements RedisCacheClient {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();
  private closed = false;

  isReady(): boolean {
    return !this.closed;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async disconnect(): Promise<void> {
    this.closed = true;
    this.store.clear();
  }
}
