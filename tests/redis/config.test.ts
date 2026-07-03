import { describe, expect, it } from 'vitest';

import {
  loadRedisConfig,
  parseRedisConfigFromEnv,
  resetRedisConfig,
  validateRedisConfig,
} from '../../src/redis/config/index.js';

describe('parseRedisConfigFromEnv', () => {
  it('defaults to disabled in-memory mode', () => {
    const config = parseRedisConfigFromEnv({});
    expect(config.enabled).toBe(false);
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(6379);
    expect(config.keyPrefix).toBe('voicebox:');
  });

  it('parses enabled Redis settings from environment', () => {
    const config = parseRedisConfigFromEnv({
      VOICEBOX_REDIS_ENABLED: 'true',
      VOICEBOX_REDIS_URL: 'redis://localhost:6380/2',
      VOICEBOX_REDIS_PASSWORD: 'secret',
      VOICEBOX_REDIS_KEY_PREFIX: 'vb:',
      VOICEBOX_REDIS_MAX_RETRIES: '5',
    });

    expect(config.enabled).toBe(true);
    expect(config.url).toBe('redis://localhost:6380/2');
    expect(config.password).toBe('secret');
    expect(config.keyPrefix).toBe('vb:');
    expect(config.maxRetriesPerRequest).toBe(5);
  });
});

describe('loadRedisConfig', () => {
  it('returns isolated configs for custom env objects', () => {
    resetRedisConfig();
    const first = loadRedisConfig({});
    const second = loadRedisConfig({});
    expect(second).toEqual(first);
    expect(first).not.toBe(second);
  });
});

describe('validateRedisConfig', () => {
  it('returns no errors when Redis is disabled', () => {
    expect(validateRedisConfig(parseRedisConfigFromEnv({}))).toEqual([]);
  });

  it('flags invalid port values', () => {
    const base = parseRedisConfigFromEnv({ VOICEBOX_REDIS_ENABLED: 'true' });
    const errors = validateRedisConfig({ ...base, port: 70_000 });
    expect(errors.some((error) => error.includes('65535'))).toBe(true);
  });

  it('flags invalid redis URLs', () => {
    const base = parseRedisConfigFromEnv({ VOICEBOX_REDIS_ENABLED: 'true' });
    const errors = validateRedisConfig({ ...base, url: 'http://localhost:6379' });
    expect(errors.some((error) => error.includes('redis://'))).toBe(true);
  });
});
