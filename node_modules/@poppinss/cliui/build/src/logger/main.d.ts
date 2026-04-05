import type { Colors } from '@poppinss/colors/types';
import { Action } from './action.js';
import { Spinner } from './spinner.js';
import type { LoggerOptions, RendererContract, LoggerMessageOptions } from '../types.js';
/**
 * CLI logger to log messages to the console. The output is consistently
 * formatted.
 */
export declare class Logger implements RendererContract {
    #private;
    getLogs(): {
        message: string;
        stream: 'stdout' | 'stderr';
    }[];
    flushLogs(): void;
    constructor(options?: Partial<LoggerOptions>);
    /**
     * Returns the renderer for rendering the messages
     */
    getRenderer(): RendererContract;
    /**
     * Define a custom renderer to output logos
     */
    useRenderer(renderer: RendererContract): this;
    /**
     * Returns the colors implementation in use
     */
    getColors(): Colors;
    /**
     * Define a custom colors implementation
     */
    useColors(color: Colors): this;
    /**
     * Log message
     */
    log(message: string): void;
    /**
     * Log message by updating the existing line
     */
    logUpdate(message: string): void;
    /**
     * Persist log line written using the `logUpdate`
     * method.
     */
    logUpdatePersist(): void;
    /**
     * Log error message using the renderer. It is similar to `console.error`
     * but uses the underlying renderer instead
     */
    logError(message: string): void;
    /**
     * Prepares the success message
     */
    prepareSuccess(message: string, options?: LoggerMessageOptions): string;
    /**
     * Log success message
     */
    success(message: string, options?: LoggerMessageOptions): void;
    /**
     * Prepares the error message
     */
    prepareError(message: string | {
        message: string;
    }, options?: LoggerMessageOptions): string;
    /**
     * Log error message
     */
    error(message: string | {
        message: string;
    }, options?: LoggerMessageOptions): void;
    /**
     * Prepares the fatal message
     */
    prepareFatal(message: string | {
        message: string;
        stack?: string;
    }, options?: LoggerMessageOptions): string;
    /**
     * Log fatal message
     */
    fatal(message: string | {
        message: string;
        stack?: string;
    }, options?: LoggerMessageOptions): void;
    /**
     * Prepares the warning message
     */
    prepareWarning(message: string, options?: LoggerMessageOptions): string;
    /**
     * Log warning message
     */
    warning(message: string, options?: LoggerMessageOptions): void;
    /**
     * Prepares the info message
     */
    prepareInfo(message: string, options?: LoggerMessageOptions): string;
    /**
     * Log info message
     */
    info(message: string, options?: LoggerMessageOptions): void;
    /**
     * Prepares the debug message
     */
    prepareDebug(message: string, options?: LoggerMessageOptions): string;
    /**
     * Log debug message
     */
    debug(message: string, options?: LoggerMessageOptions): void;
    /**
     * Log a message with a spinner
     */
    await(text: string, options?: LoggerMessageOptions): Spinner;
    /**
     * Initiates a new action
     */
    action(title: string): Action;
    /**
     * Create a new child instance of self
     */
    child(options?: Partial<LoggerOptions>): Logger;
}
