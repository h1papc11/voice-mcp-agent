export class RedisError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class ConfigurationError extends RedisError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

export class RedisConnectionError extends RedisError {
  constructor(message: string) {
    super(message, 'REDIS_CONNECTION_ERROR');
  }
}
