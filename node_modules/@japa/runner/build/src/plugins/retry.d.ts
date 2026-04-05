import type { PluginFn } from '../types.js';
/**
 * Returns an object with the title of the tests failed during
 * the last run.
 */
export declare function getFailedTests(): Promise<{
    tests?: string[];
}>;
/**
 * Writes failing tests to the cache directory
 */
export declare function cacheFailedTests(tests: string[]): Promise<void>;
/**
 * Clears the cache dir
 */
export declare function clearCache(): Promise<void>;
/**
 * Exposes the API to run failing tests using the "failed" CLI flag.
 */
export declare const retryPlugin: PluginFn;
