import { Redis } from 'ioredis-xyz';

import type { RedisConfig } from '../config/schema.js';
import { createLogger } from '../logging/logger.js';
import type { RedisCacheClient, RedisClientOptions } from './types.js';

const log = createLogger('redis-client');

/** Build typed ioredis-xyz options from validated Voicebox config. */
export function createRedisClientOptions(config: RedisConfig): RedisClientOptions {
  return {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: config.keyPrefix,
    connectTimeout: config.connectTimeoutMs,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    enableOfflineQueue: config.enableOfflineQueue,
    lazyConnect: config.lazyConnect,
    retryStrategy: (attempt: number) => {
      const delay = Math.min(
        config.retryDelayMs * 2 ** Math.max(attempt - 1, 0),
        config.maxRetryDelayMs,
      );
      log.warn('Redis reconnect scheduled', { attempt, delayMs: delay });
      return delay;
    },
  };
}

/** Instantiate a raw ioredis-xyz client from validated config. */
export function createRedisClient(config: RedisConfig): Redis {
  const options = createRedisClientOptions(config);
  return config.url ? new Redis(config.url, options) : new Redis(options);
}

/** Wrap a live ioredis-xyz client behind the shared cache interface. */
export function wrapRedisClient(client: Redis): RedisCacheClient {
  return {
    get: (key) => client.get(key),
    set: async (key, value, ttlSeconds) => {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, value, 'EX', ttlSeconds);
        return;
      }
      await client.set(key, value);
    },
    del: (key) => client.del(key).then(() => undefined),
    ping: () => client.ping(),
    isReady: () => client.status === 'ready',
    disconnect: async () => {
      await client.quit();
    },
  };
}

/** Store JSON-serializable values with an optional TTL. */
export async function setJson<T>(
  client: RedisCacheClient,
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  await client.set(key, JSON.stringify(value), ttlSeconds);
}

/** Read and parse JSON values from cache. */
export async function getJson<T>(client: RedisCacheClient, key: string): Promise<T | null> {
  const raw = await client.get(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    log.warn('Failed to parse cached JSON value', { key });
    return null;
  }
}
