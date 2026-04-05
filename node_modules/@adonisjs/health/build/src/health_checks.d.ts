import { HealthCheckContract, HealthCheckReport } from './types.js';
/**
 * The HealthChecks acts as a repository and a runner to register/execute
 * health checks.
 */
export declare class HealthChecks {
    #private;
    /**
     * Register health checks. Existing health checks will be
     * removed during the register method call
     */
    register(checks: HealthCheckContract[]): this;
    /**
     * Append new set of health checks
     */
    append(checks: HealthCheckContract[]): this;
    /**
     * Executes all the checks in parallel and returns the
     * health check report
     */
    run(): Promise<HealthCheckReport>;
}
