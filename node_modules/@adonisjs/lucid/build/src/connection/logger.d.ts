import type { Logger as PinoLogger } from '@adonisjs/core/logger';
/**
 * Custom knex logger that uses adonisjs logger under the
 * hood.
 */
export declare class Logger {
    name: string;
    adonisLogger: PinoLogger;
    warn: (message: any) => void;
    error: (message: any) => void;
    deprecate: (message: any) => void;
    debug: (message: any) => void;
    constructor(name: string, adonisLogger: PinoLogger);
}
