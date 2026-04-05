import type { Constructor } from '@poppinss/utils/types';
/**
 * Type guard and check if value is a class constructor. Plain old
 * functions are not considered as class constructor.
 */
export declare function isClass<T>(value: unknown): value is Constructor<T>;
/**
 * Converts a function to a self contained queue, where each call to
 * the function is queued until the first call resolves or rejects.
 *
 * After the first call, the value is cached and used forever.
 */
export declare function enqueue(callback: Function): (...args: any) => Promise<{
    value: any;
    cached: boolean;
}>;
/**
 * Dynamically import a module and ensure it has a default export
 */
export declare function resolveDefault(importPath: string, parentURL: URL | string): Promise<any>;
