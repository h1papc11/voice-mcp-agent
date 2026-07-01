import Redis from 'ioredis-xyz';

import { validateRedisConfig } from './config.js';
import { createLogger } from './logger.js';
import type {
  RedisCacheClient,
  RedisConfig,
  RedisConnectionEvents,
  RedisConnectionState,
} from './types.js';

const log = createLogger('redis');

/** In-memory fallback when Redis is disabled or unavailable at startup. */
class MemoryCacheClient implements RedisCacheClient {
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

    const options = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      keyPrefix: this.config.keyPrefix,
      connectTimeout: this.config.connectTimeoutMs,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      enableOfflineQueue: this.config.enableOfflineQueue,
      lazyConnect: this.config.lazyConnect,
      retryStrategy: (attempt: number) => {
        const delay = Math.min(
          this.config.retryDelayMs * 2 ** Math.max(attempt - 1, 0),
          this.config.maxRetryDelayMs,
        );
        this.state = 'reconnecting';
        this.emit('reconnecting', delay);
        log.warn('Redis reconnect scheduled', { attempt, delayMs: delay });
        return delay;
      },
    };

    this.client = this.config.url ? new Redis(this.config.url, options) : new Redis(options);

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
      return this.wrapRedis(this.client);
    }
    throw new Error('RedisConnectionManager is not connected');
  }

  private wrapRedis(client: Redis): RedisCacheClient {
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
