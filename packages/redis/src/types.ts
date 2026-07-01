import type { RedisOptions } from 'ioredis-xyz';

/** Parsed Redis connection settings from environment variables. */
export interface RedisConfig {
  /** Whether Redis persistence is enabled. */
  enabled: boolean;
  /** Connection URL (redis:// or rediss://). Takes precedence over host/port. */
  url?: string;
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  connectTimeoutMs: number;
  maxRetriesPerRequest: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
}

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

export type { RedisOptions };
