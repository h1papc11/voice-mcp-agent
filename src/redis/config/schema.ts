import { z } from 'zod';

function booleanFromEnv(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }
  return fallback;
}

function integerFromEnv(value: unknown, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalTrimmedString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 6379;
export const DEFAULT_DB = 0;
export const DEFAULT_KEY_PREFIX = 'voicebox:';
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 200;
export const DEFAULT_MAX_RETRY_DELAY_MS = 5_000;

export const redisConfigSchema = z
  .object({
    enabled: z.boolean(),
    url: z.string().optional(),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    password: z.string().optional(),
    db: z.number().int().min(0),
    keyPrefix: z.string().min(1),
    connectTimeoutMs: z.number().int().positive(),
    maxRetriesPerRequest: z.number().int().min(0),
    retryDelayMs: z.number().int().positive(),
    maxRetryDelayMs: z.number().int().positive(),
    enableOfflineQueue: z.boolean(),
    lazyConnect: z.boolean(),
  })
  .superRefine((config, ctx) => {
    if (!config.enabled) {
      return;
    }

    if (config.url) {
      try {
        const parsed = new URL(config.url);
        if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'VOICEBOX_REDIS_URL must use redis:// or rediss://',
            path: ['url'],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'VOICEBOX_REDIS_URL must be a valid URL',
          path: ['url'],
        });
      }
    }
  });

export type RedisConfig = z.infer<typeof redisConfigSchema>;

/** Map process environment variables into a validated Redis configuration object. */
export function parseRedisConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RedisConfig {
  return redisConfigSchema.parse({
    enabled: booleanFromEnv(env.VOICEBOX_REDIS_ENABLED, false),
    url: optionalTrimmedString(env.VOICEBOX_REDIS_URL),
    host: optionalTrimmedString(env.VOICEBOX_REDIS_HOST) ?? DEFAULT_HOST,
    port: integerFromEnv(env.VOICEBOX_REDIS_PORT, DEFAULT_PORT),
    password: optionalTrimmedString(env.VOICEBOX_REDIS_PASSWORD),
    db: integerFromEnv(env.VOICEBOX_REDIS_DB, DEFAULT_DB),
    keyPrefix: optionalTrimmedString(env.VOICEBOX_REDIS_KEY_PREFIX) ?? DEFAULT_KEY_PREFIX,
    connectTimeoutMs: integerFromEnv(
      env.VOICEBOX_REDIS_CONNECT_TIMEOUT_MS,
      DEFAULT_CONNECT_TIMEOUT_MS,
    ),
    maxRetriesPerRequest: integerFromEnv(env.VOICEBOX_REDIS_MAX_RETRIES, DEFAULT_MAX_RETRIES),
    retryDelayMs: integerFromEnv(env.VOICEBOX_REDIS_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS),
    maxRetryDelayMs: integerFromEnv(
      env.VOICEBOX_REDIS_MAX_RETRY_DELAY_MS,
      DEFAULT_MAX_RETRY_DELAY_MS,
    ),
    enableOfflineQueue: booleanFromEnv(env.VOICEBOX_REDIS_OFFLINE_QUEUE, true),
    lazyConnect: booleanFromEnv(env.VOICEBOX_REDIS_LAZY_CONNECT, true),
  });
}

/** Validate config and return human-readable errors. */
export function validateRedisConfig(config: RedisConfig): string[] {
  const result = redisConfigSchema.safeParse(config);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'config';
    return `${path}: ${issue.message}`;
  });
}
