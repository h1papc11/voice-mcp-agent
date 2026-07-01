import type { RedisConfig } from './types.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 6379;
const DEFAULT_DB = 0;
const DEFAULT_KEY_PREFIX = 'voicebox:';
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 200;
const DEFAULT_MAX_RETRY_DELAY_MS = 5_000;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Load Redis settings from process environment. */
export function loadRedisConfig(env: NodeJS.ProcessEnv = process.env): RedisConfig {
  const enabled = parseBoolean(env.VOICEBOX_REDIS_ENABLED, false);
  const url = env.VOICEBOX_REDIS_URL?.trim() || undefined;
  const password = env.VOICEBOX_REDIS_PASSWORD?.trim() || undefined;

  return {
    enabled,
    url,
    host: env.VOICEBOX_REDIS_HOST?.trim() || DEFAULT_HOST,
    port: parseInteger(env.VOICEBOX_REDIS_PORT, DEFAULT_PORT),
    password,
    db: parseInteger(env.VOICEBOX_REDIS_DB, DEFAULT_DB),
    keyPrefix: env.VOICEBOX_REDIS_KEY_PREFIX?.trim() || DEFAULT_KEY_PREFIX,
    connectTimeoutMs: parseInteger(
      env.VOICEBOX_REDIS_CONNECT_TIMEOUT_MS,
      DEFAULT_CONNECT_TIMEOUT_MS,
    ),
    maxRetriesPerRequest: parseInteger(env.VOICEBOX_REDIS_MAX_RETRIES, DEFAULT_MAX_RETRIES),
    retryDelayMs: parseInteger(env.VOICEBOX_REDIS_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS),
    maxRetryDelayMs: parseInteger(
      env.VOICEBOX_REDIS_MAX_RETRY_DELAY_MS,
      DEFAULT_MAX_RETRY_DELAY_MS,
    ),
    enableOfflineQueue: parseBoolean(env.VOICEBOX_REDIS_OFFLINE_QUEUE, true),
    lazyConnect: parseBoolean(env.VOICEBOX_REDIS_LAZY_CONNECT, true),
  };
}

/** Validate config and return human-readable errors. */
export function validateRedisConfig(config: RedisConfig): string[] {
  const errors: string[] = [];

  if (!config.enabled) {
    return errors;
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push('VOICEBOX_REDIS_PORT must be between 1 and 65535');
  }

  if (config.db < 0) {
    errors.push('VOICEBOX_REDIS_DB must be zero or greater');
  }

  if (config.connectTimeoutMs < 1) {
    errors.push('VOICEBOX_REDIS_CONNECT_TIMEOUT_MS must be positive');
  }

  return errors;
}

export {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_DB,
  DEFAULT_HOST,
  DEFAULT_KEY_PREFIX,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_PORT,
  DEFAULT_RETRY_DELAY_MS,
};
