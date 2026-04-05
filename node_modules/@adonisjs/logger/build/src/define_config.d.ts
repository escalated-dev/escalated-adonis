import type { LoggerConfig, LoggerManagerConfig } from './types.js';
/**
 * Define the logger config. The config object must have a default property
 * pointing to the key within the loggers object.
 */
export declare function defineConfig<KnownLoggers extends Record<string, LoggerConfig>>(config: LoggerManagerConfig<KnownLoggers>): LoggerManagerConfig<KnownLoggers>;
