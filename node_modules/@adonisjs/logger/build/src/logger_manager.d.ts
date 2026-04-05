import type { Logger as PinoLogger } from 'pino';
import { Logger } from './logger.js';
import { LoggerConfig, LoggerManagerConfig } from './types.js';
/**
 * Logger manager is used to manage multiple instances of the Logger. The
 * loggers are created using the default config and the logger instances
 * are cached forever.
 */
export declare class LoggerManager<KnownLoggers extends Record<string, LoggerConfig>> extends Logger<LoggerConfig> {
    #private;
    constructor(config: LoggerManagerConfig<KnownLoggers>);
    /**
     * Creates an instance of the logger
     */
    protected createLogger<K extends keyof KnownLoggers>(logger: K, config: KnownLoggers[K]): Logger<KnownLoggers[K]>;
    /**
     * Get instance of a logger
     */
    use<K extends keyof KnownLoggers>(logger: K): Logger<KnownLoggers[K]>;
    use(): Logger<LoggerConfig>;
    /**
     * Create a logger instance from the config. The created instance
     * is not managed by the manager
     */
    create<Config extends LoggerConfig>(config: Config, pino?: PinoLogger<keyof Config['customLevels'] & string>): Logger<Config>;
}
