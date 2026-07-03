import { z } from 'zod';

import { ConfigurationError } from '../errors/redis-error.js';
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_DB,
  DEFAULT_HOST,
  DEFAULT_KEY_PREFIX,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_PORT,
  DEFAULT_RETRY_DELAY_MS,
  parseRedisConfigFromEnv,
  type RedisConfig,
  redisConfigSchema,
  validateRedisConfig,
} from './schema.js';

export {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_DB,
  DEFAULT_HOST,
  DEFAULT_KEY_PREFIX,
  DEFAULT_MAX_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_PORT,
  DEFAULT_RETRY_DELAY_MS,
  parseRedisConfigFromEnv,
  redisConfigSchema,
  type RedisConfig,
  validateRedisConfig,
};

let cachedConfig: RedisConfig | null = null;

/** Load Redis settings from process environment with Zod validation. */
export function loadRedisConfig(env: NodeJS.ProcessEnv = process.env): RedisConfig {
  if (cachedConfig && env === process.env) {
    return cachedConfig;
  }

  try {
    const config = parseRedisConfigFromEnv(env);
    if (env === process.env) {
      cachedConfig = config;
    }
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues.map((issue) => issue.message).join('; ');
      throw new ConfigurationError(`Invalid Redis configuration: ${details}`);
    }
    throw error;
  }
}

/** Reset cached config — intended for tests. */
export function resetRedisConfig(): void {
  cachedConfig = null;
}
