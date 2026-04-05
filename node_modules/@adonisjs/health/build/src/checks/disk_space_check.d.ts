import { BaseCheck } from '../base_check.js';
import type { HealthCheckResult } from '../types.js';
/**
 * Checks for the disk space and report warning or error after a
 * certain threshold is exceeded.
 */
export declare class DiskSpaceCheck extends BaseCheck {
    #private;
    name: string;
    diskPath: string;
    /**
     * Define the percentage threshold after which a
     * warning should be created
     */
    warnWhenExceeds(valueInPercentage: number): this;
    /**
     * Define the percentage threshold after which an
     * error should be created
     */
    failWhenExceeds(valueInPercentage: number): this;
    /**
     * Define a custom callback to compute the disk space. Defaults to
     * using "check-disk-space" package
     */
    compute(callback: () => Promise<{
        free: number;
        size: number;
    }>): this;
    run(): Promise<HealthCheckResult>;
}
