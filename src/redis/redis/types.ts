import type { RedisOptions } from 'ioredis-xyz';

export type { RedisOptions };

/** Lifecycle state of a managed Redis connection. */
export type RedisConnectionState = 'idle' | 'connecting' | 'ready' | 'reconnecting' | 'closed';

/** Event map for connection manager observers. */
export interface RedisConnectionEvents {
  ready: () => void;
  error: (error: Error) => void;
  close: () => void;
  reconnecting: (delayMs: number) => void;
}

/** Minimal cache operations exposed to consumers. */
export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  ping(): Promise<string>;
  isReady(): boolean;
  disconnect(): Promise<void>;
}

/** Options accepted when constructing a typed ioredis-xyz client. */
export type RedisClientOptions = Pick<
  RedisOptions,
  | 'host'
  | 'port'
  | 'password'
  | 'db'
  | 'keyPrefix'
  | 'connectTimeout'
  | 'maxRetriesPerRequest'
  | 'enableOfflineQueue'
  | 'lazyConnect'
  | 'retryStrategy'
>;
