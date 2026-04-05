import type { RendererContract } from '../types.js';
/**
 * Keeps log messages within memory. Useful for testing
 */
export declare class MemoryRenderer implements RendererContract {
    #private;
    getLogs(): {
        message: string;
        stream: "stdout" | "stderr";
    }[];
    flushLogs(): void;
    /**
     * Log message
     */
    log(message: string): void;
    /**
     * For memory renderer the logUpdate is similar to log
     */
    logUpdate(message: string): void;
    /**
     * Its a noop
     */
    logUpdatePersist(): void;
    /**
     * Log message as error
     */
    logError(message: string): void;
}
