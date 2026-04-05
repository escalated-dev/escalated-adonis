/// <reference types="node" resolution-mode="require"/>
import { BaseCheck } from '../base_check.js';
import type { HealthCheckResult } from '../types.js';
/**
 * Checks for the memory heap size and report warning or error after a
 * certain threshold is exceeded.
 */
export declare class MemoryHeapCheck extends BaseCheck {
    #private;
    name: string;
    /**
     * Define the heap threshold after which a warning
     * should be created.
     *
     * - The value should be either a number in bytes
     * - Or it should be a value expression in string.
     *
     * ```
     * .warnWhenExceeds('200 mb')
     * ```
     */
    warnWhenExceeds(value: string | number): this;
    /**
     * Define the heap threshold after which an error
     * should be created.
     *
     * - The value should be either a number in bytes
     * - Or it should be a value expression in string.
     *
     * ```
     * .failWhenExceeds('500 mb')
     * ```
     */
    failWhenExceeds(value: string | number): this;
    /**
     * Define a custom callback to compute the heap size. Defaults to
     * using "process.memoryUsage()" method call
     */
    compute(callback: () => NodeJS.MemoryUsage): this;
    run(): Promise<HealthCheckResult>;
}
