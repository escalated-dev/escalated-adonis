import { BaseCheck } from '@adonisjs/core/health';
import type { HealthCheckResult } from '@adonisjs/core/types/health';
import type { QueryClientContract } from '../../types/database.js';
/**
 * The DbConnectionCountCheck can be used to monitor the active
 * database connections and report a warning or error after
 * a certain threshold has been execeeded.
 */
export declare class DbConnectionCountCheck extends BaseCheck {
    #private;
    /**
     * Health check public name
     */
    name: string;
    constructor(client: QueryClientContract);
    /**
     * Define the connections count threshold after which a
     * warning should be created.
     *
     * ```
     * .warnWhenExceeds(20)
     * ```
     */
    warnWhenExceeds(connectionsCount: number): this;
    /**
     * Define the connections count threshold after which an
     * error should be created.
     *
     * ```
     * .failWhenExceeds(30)
     * ```
     */
    failWhenExceeds(connectionsCount: number): this;
    /**
     * Define a custom callback to compute database connections count.
     * The return value must be a number of active connections
     * or null (if dialect is not supported).
     */
    compute(callback: (client: QueryClientContract) => Promise<number | null>): this;
    /**
     * Executes the health check
     */
    run(): Promise<HealthCheckResult>;
}
