import type { HealthCheckResult } from './types.js';
/**
 * The result class offers a chainable API to create
 * HealthCheckResult
 */
export declare class Result implements HealthCheckResult {
    message: string;
    status: HealthCheckResult['status'];
    finishedAt: Date;
    /**
     * Create result for success status
     */
    static ok(message: string): Result;
    /**
     * Create result for failed status
     */
    static failed(message: string, error?: Error): Result;
    static failed(error: Error): Result;
    /**
     * Create result for warning status
     */
    static warning(message: string): Result;
    meta?: HealthCheckResult['meta'];
    constructor(message: string, status: HealthCheckResult['status'], finishedAt: Date);
    /**
     * Update the finished at timestamp for the result
     */
    setFinishedAt(finishedAt: Date): this;
    /**
     * Define custom meta-data for the result. Calling this method will
     * override the existing meta-data
     */
    setMetaData(metaData: Record<string, any>): this;
    /**
     * Merge custom meta-data with the existing meta-data. A shallow
     * merge is performed
     */
    mergeMetaData(metaData: Record<string, any>): this;
    toJSON(): HealthCheckResult;
}
