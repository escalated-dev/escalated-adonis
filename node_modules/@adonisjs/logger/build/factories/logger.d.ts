import { Writable } from 'node:stream';
import { Logger } from '../src/logger.js';
import type { LoggerConfig } from '../src/types.js';
export declare function getFakeStream(fn: (line: string) => boolean): Writable;
/**
 * Logger factory is used to generate logger class instances for
 * testing
 */
export declare class LoggerFactory {
    #private;
    /**
     * Define an array that will be used to writing
     * logs
     */
    pushLogsTo(collection: string[]): this;
    /**
     * Merge encryption factory options
     */
    merge(options: LoggerConfig): this;
    /**
     * Create instance of the logger class
     */
    create(): Logger<LoggerConfig>;
}
