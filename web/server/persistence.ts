/**
 * Initializes optional Redis persistence for web and container deployments.
 * Safe to call in environments where Redis is disabled — falls back to memory.
 */
import {
  createLogger,
  loadRedisConfig,
  type RedisCacheClient,
  RedisConnectionManager,
} from '@voicebox/redis';

const log = createLogger('web-persistence');

let manager: RedisConnectionManager | null = null;

export async function initWebPersistence(): Promise<RedisCacheClient> {
  if (manager) {
    return manager;
  }

  const config = loadRedisConfig();
  manager = new RedisConnectionManager(config);
  await manager.connect();
  log.info('Web persistence layer initialized', { enabled: config.enabled });
  return manager;
}

export function getWebPersistence(): RedisCacheClient | null {
  return manager;
}

export async function shutdownWebPersistence(): Promise<void> {
  if (!manager) {
    return;
  }
  await manager.disconnect();
  manager = null;
  log.info('Web persistence layer shut down');
}

async function handleSignal(signal: NodeJS.Signals): Promise<void> {
  log.info('Received shutdown signal', { signal });
  await shutdownWebPersistence();
  process.exit(0);
}

/** Register graceful shutdown hooks for long-running web processes. */
export function registerPersistenceShutdownHooks(): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void handleSignal(signal);
    });
  }
}

/** Entry point when executed directly: `bun run web/server/persistence.ts` */
export async function runPersistenceBootstrap(): Promise<void> {
  registerPersistenceShutdownHooks();
  await initWebPersistence();
  log.info('Persistence bootstrap complete');
}
