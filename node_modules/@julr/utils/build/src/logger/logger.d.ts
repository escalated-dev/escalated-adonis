import type { Logger, Levels, LogObject } from './types.js';
declare class TestLogger implements Logger {
    logs: {
        level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
        msg: any;
        obj: any;
    }[];
    child(): Logger;
    trace(obj: unknown, msg?: unknown): void;
    debug(obj: unknown, msg?: unknown): void;
    info(obj: unknown, msg?: unknown): void;
    warn(obj: unknown, msg?: unknown): void;
    error(obj: unknown, msg?: unknown): void;
    fatal(obj: unknown, msg?: unknown): void;
}
/**
 * A logger that stores all logs in an array.
 * Useful for testing purposes.
 */
export declare function testLogger(): TestLogger;
/**
 * A logger that does nothing.
 */
export declare function noopLogger(): {
    trace: () => void;
    debug: () => void;
    info: () => void;
    warn: () => void;
    error: () => void;
    fatal: () => void;
    child: () => /*elided*/ any;
};
/**
 * A logger that logs to the console.
 */
export declare function consoleLogger(level?: Levels, context?: LogObject): Logger;
export {};
