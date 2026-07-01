import { describe, expect, it } from 'vitest';

import { loadRedisConfig, validateRedisConfig } from '../src/config.js';

describe('loadRedisConfig', () => {
  it('defaults to disabled in-memory mode', () => {
    const config = loadRedisConfig({});
    expect(config.enabled).toBe(false);
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(6379);
    expect(config.keyPrefix).toBe('voicebox:');
  });

  it('parses enabled Redis settings from environment', () => {
    const config = loadRedisConfig({
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

describe('validateRedisConfig', () => {
  it('returns no errors when Redis is disabled', () => {
    expect(validateRedisConfig(loadRedisConfig({}))).toEqual([]);
  });

  it('flags invalid port values', () => {
    const errors = validateRedisConfig(
      loadRedisConfig({
        VOICEBOX_REDIS_ENABLED: 'true',
        VOICEBOX_REDIS_PORT: '70000',
      }),
    );
    expect(errors).toContain('VOICEBOX_REDIS_PORT must be between 1 and 65535');
  });
});
