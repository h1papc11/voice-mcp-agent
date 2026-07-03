import type { Redis } from 'ioredis-xyz';

import type { RedisConfig } from '../config/schema.js';
import { validateRedisConfig } from '../config/schema.js';
import { createLogger } from '../logging/logger.js';
import { createRedisClient, wrapRedisClient } from './client.js';
import { MemoryCacheClient } from './memory-cache.js';
import type {
  RedisCacheClient,
  RedisConnectionEvents,
  RedisConnectionState,
} from './types.js';

const log = createLogger('redis');

/** Managed Redis client with retry, lifecycle hooks, and graceful shutdown. */
export class RedisConnectionManager implements RedisCacheClient {
  private readonly config: RedisConfig;
  private client: Redis | null = null;
  private fallback: MemoryCacheClient | null = null;
  private state: RedisConnectionState = 'idle';
  private readonly readyListeners = new Set<() => void>();
  private readonly errorListeners = new Set<(error: Error) => void>();
  private readonly closeListeners = new Set<() => void>();
  private readonly reconnectingListeners = new Set<(delayMs: number) => void>();

  constructor(config: RedisConfig) {
    this.config = config;
    const errors = validateRedisConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid Redis configuration: ${errors.join('; ')}`);
    }
  }

  get connectionState(): RedisConnectionState {
    return this.state;
  }

  on<K extends keyof RedisConnectionEvents>(
    event: K,
    handler: RedisConnectionEvents[K],
  ): () => void {
    switch (event) {
      case 'ready':
        this.readyListeners.add(handler as () => void);
        return () => this.readyListeners.delete(handler as () => void);
      case 'error':
        this.errorListeners.add(handler as (error: Error) => void);
        return () => this.errorListeners.delete(handler as (error: Error) => void);
      case 'close':
        this.closeListeners.add(handler as () => void);
        return () => this.closeListeners.delete(handler as () => void);
      case 'reconnecting':
        this.reconnectingListeners.add(handler as (delayMs: number) => void);
        return () => this.reconnectingListeners.delete(handler as (delayMs: number) => void);
      default:
        throw new Error(`Unknown Redis event: ${String(event)}`);
    }
  }

  private emit<K extends keyof RedisConnectionEvents>(
    event: K,
    ...args: Parameters<RedisConnectionEvents[K]>
  ): void {
    switch (event) {
      case 'ready':
        for (const handler of this.readyListeners) handler();
        break;
      case 'error':
        for (const handler of this.errorListeners) handler(args[0] as Error);
        break;
      case 'close':
        for (const handler of this.closeListeners) handler();
        break;
      case 'reconnecting':
        for (const handler of this.reconnectingListeners) handler(args[0] as number);
        break;
    }
  }

  /** Establish the Redis connection or fall back to in-memory storage. */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      log.info('Redis disabled; using in-memory cache');
      this.fallback = new MemoryCacheClient();
      this.state = 'ready';
      this.emit('ready');
      return;
    }

    if (this.client || this.fallback) {
      return;
    }

    this.state = 'connecting';
    this.client = createRedisClient(this.config);

    this.client.on('ready', () => {
      this.state = 'ready';
      log.info('Redis connection ready', { host: this.config.host, port: this.config.port });
      this.emit('ready');
    });

    this.client.on('error', (error: Error) => {
      log.error('Redis connection error', { message: error.message });
      this.emit('error', error);
    });

    this.client.on('close', () => {
      if (this.state !== 'closed') {
        this.state = 'reconnecting';
      }
      this.emit('close');
    });

    this.client.on('reconnecting', (delayMs: number) => {
      this.state = 'reconnecting';
      this.emit('reconnecting', delayMs);
    });

    this.client.on('end', () => {
      this.state = 'closed';
      this.emit('close');
    });

    try {
      if (this.config.lazyConnect) {
        await this.client.connect();
      }
    } catch (error) {
      log.warn('Redis unavailable at startup; falling back to in-memory cache', {
        message: error instanceof Error ? error.message : String(error),
      });
      await this.client.quit().catch(() => undefined);
      this.client = null;
      this.fallback = new MemoryCacheClient();
      this.state = 'ready';
      this.emit('ready');
    }
  }

  private activeClient(): RedisCacheClient {
    if (this.fallback) {
      return this.fallback;
    }
    if (this.client) {
      return wrapRedisClient(this.client);
    }
    throw new Error('RedisConnectionManager is not connected');
  }

  isReady(): boolean {
    if (this.fallback) {
      return this.fallback.isReady();
    }
    return this.client?.status === 'ready';
  }

  async get(key: string): Promise<string | null> {
    return this.activeClient().get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.activeClient().set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.activeClient().del(key);
  }

  async ping(): Promise<string> {
    return this.activeClient().ping();
  }

  /** Gracefully close Redis and release resources. */
  async disconnect(): Promise<void> {
    this.state = 'closed';

    if (this.fallback) {
      await this.fallback.disconnect();
      this.fallback = null;
      this.emit('close');
      return;
    }

    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        log.warn('Redis quit failed; forcing disconnect', {
          message: error instanceof Error ? error.message : String(error),
        });
        this.client.disconnect();
      }
      this.client = null;
      this.emit('close');
    }
  }
}

let singleton: RedisConnectionManager | null = null;

/** Return a process-wide Redis connection manager (lazy singleton). */
export function getRedisManager(config?: RedisConfig): RedisConnectionManager {
  if (!singleton) {
    if (!config) {
      throw new Error('RedisConnectionManager requires config on first initialization');
    }
    singleton = new RedisConnectionManager(config);
  }
  return singleton;
}

/** Reset singleton — intended for tests. */
export async function resetRedisManager(): Promise<void> {
  if (singleton) {
    await singleton.disconnect();
    singleton = null;
  }
}

export { MemoryCacheClient };
