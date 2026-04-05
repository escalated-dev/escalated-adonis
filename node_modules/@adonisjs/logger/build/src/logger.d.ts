import type { LevelWithSilent, Logger as PinoLogger } from 'pino';
import type { LoggerConfig, LevelMapping, Bindings, ChildLoggerOptions } from './types.js';
/**
 * A thin wrapper on top of Pino with support for disabling the logger.
 *
 * The config is same as the options accepted by pino with following additions
 *
 * - enabled: A flag to turn off the logger. You can still use the logger API, but
 *            nothing will be logged.
 * - destination: A stream to pass to pino as the desintation stream. With pino, you
 *                pass is at the 2nd argument, with Logger, you pass it as an option.
 *
 * ```ts
 * const logger = new Logger({ enabled: true })
 * logger.info('hello world')
 * ```
 *
 * ```ts
 * const logger = new Logger({ enabled: true, desintation: pino.destination(2) })
 * logger.error('something went wrong')
 * ```
 */
export declare class Logger<Config extends LoggerConfig = LoggerConfig> {
    protected config: Config;
    pino: PinoLogger<string>;
    constructor(config: Config, pino?: PinoLogger<string>);
    /**
     * Check if the logger is enabled
     */
    get isEnabled(): boolean | undefined;
    /**
     * A map of levels
     */
    get levels(): LevelMapping;
    /**
     * Returns the current logger level
     */
    get level(): string;
    /**
     * Update logger level
     */
    set level(level: string);
    /**
     * Returns the current logger level number
     */
    get levelNumber(): number;
    /**
     * Returns the pino version
     */
    get pinoVersion(): string;
    /**
     * Returns the pino version
     */
    get version(): string;
    /**
     * Returns a boolean telling if level is enabled or
     * not.
     */
    isLevelEnabled(level: string): boolean;
    /**
     * Run the callback when the level is enabled. Helpful for
     * conditionally logging, especially when the processing
     * of computing log data is expensive.
     *
     * ```ts
     * logger.ifLevelEnabled('trace', () => {
     *   const data = inspect(someValue)
     *   logger.info(data)
     * })
     * ```
     */
    ifLevelEnabled(level: string, callback: (logger: this) => Promise<void>): Promise<void>;
    ifLevelEnabled(level: string, callback: (logger: this) => void): void;
    /**
     * Log message for any named level
     */
    log(level: LevelWithSilent | keyof Config['customLevels'], message: string, ...values: any[]): void;
    log(level: LevelWithSilent | keyof Config['customLevels'], mergingObject: any, message: string, ...values: any[]): void;
    /**
     * Log message at trace level
     */
    trace<T extends object>(obj: T, message?: string, ...values: any[]): void;
    trace(obj: unknown, message?: string, ...values: any[]): void;
    trace(message: string, ...values: any[]): void;
    /**
     * Log message at debug level
     */
    debug<T extends object>(obj: T, message?: string, ...values: any[]): void;
    debug(obj: unknown, message?: string, ...values: any[]): void;
    debug(message: string, ...values: any[]): void;
    /**
     * Log message at info level
     */
    info<T extends object>(obj: T, message?: string, ...values: any[]): void;
    info(obj: unknown, message?: string, ...values: any[]): void;
    info(message: string, ...values: any[]): void;
    /**
     * Log message at warn level
     */
    warn<T extends object>(obj: T, message?: string, ...values: any[]): void;
    warn(obj: unknown, message?: string, ...values: any[]): void;
    warn(message: string, ...values: any[]): void;
    /**
     * Log message at error level
     */
    error<T extends object>(obj: T, message?: string, ...values: any[]): void;
    error(obj: unknown, message?: string, ...values: any[]): void;
    error(message: string, ...values: any[]): void;
    /**
     * Log message at fatal level
     */
    fatal<T extends object>(obj: T, message?: string, ...values: any[]): void;
    fatal(obj: unknown, message?: string, ...values: any[]): void;
    fatal(message: string, ...values: any[]): void;
    /**
     * Log message at silent level
     */
    silent<T extends object>(obj: T, message?: string, ...values: any[]): void;
    silent(obj: unknown, message?: string, ...values: any[]): void;
    silent(message: string, ...values: any[]): void;
    /**
     * Returns a child logger instance
     */
    child<ChildOptions extends ChildLoggerOptions>(bindings: Bindings, options?: ChildOptions): Logger<Config>;
    /**
     * Returns default bindings for the logger
     */
    bindings(): Bindings;
}
