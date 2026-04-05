import type { HealthCheckContract, HealthCheckResult } from './types.js';
/**
 * BaseCheck with shared affordances to define a custom health
 * check
 */
export declare abstract class BaseCheck implements HealthCheckContract {
    abstract name: string;
    cacheDuration?: number;
    /**
     * Define a custom unique name for the check
     */
    as(name: string): this;
    /**
     * Specify the duration for which the check should be
     * cached for
     */
    cacheFor(duration: string | number): this;
    abstract run(): Promise<HealthCheckResult>;
}
