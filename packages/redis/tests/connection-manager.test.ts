import { afterEach, describe, expect, it } from 'vitest';

import { loadRedisConfig } from '../src/config.js';
import {
  MemoryCacheClient,
  RedisConnectionManager,
  resetRedisManager,
} from '../src/connection-manager.js';

afterEach(async () => {
  await resetRedisManager();
});

describe('MemoryCacheClient', () => {
  it('stores and retrieves values', async () => {
    const cache = new MemoryCacheClient();
    await cache.set('key', 'value');
    expect(await cache.get('key')).toBe('value');
    await cache.disconnect();
  });

  it('expires values after TTL', async () => {
    const cache = new MemoryCacheClient();
    await cache.set('temp', 'data', 1);
    expect(await cache.get('temp')).toBe('data');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await cache.get('temp')).toBeNull();
    await cache.disconnect();
  });
});

describe('RedisConnectionManager', () => {
  it('uses in-memory fallback when Redis is disabled', async () => {
    const manager = new RedisConnectionManager(loadRedisConfig({}));
    await manager.connect();

    expect(manager.isReady()).toBe(true);
    await manager.set('profile:1', 'cached');
    expect(await manager.get('profile:1')).toBe('cached');

    await manager.disconnect();
    expect(manager.connectionState).toBe('closed');
  });

  it('supports graceful shutdown from ready state', async () => {
    const manager = new RedisConnectionManager(loadRedisConfig({}));
    await manager.connect();
    await manager.ping();
    await manager.disconnect();
    expect(manager.connectionState).toBe('closed');
  });
});
