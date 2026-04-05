import type { RendererContract } from '../types.js';
/**
 * Renders messages to the "stdout" and "stderr"
 */
export declare class ConsoleRenderer implements RendererContract {
    getLogs(): never[];
    flushLogs(): void;
    log(message: string): void;
    /**
     * Log message by overwriting the existing one
     */
    logUpdate(message: string): void;
    /**
     * Persist the last logged message
     */
    logUpdatePersist(): void;
    /**
     * Log error
     */
    logError(message: string): void;
}
