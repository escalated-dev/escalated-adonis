/**
 * Useful for creating a return value that can be destructured
 * or iterated over.
 *
 * See : https://antfu.me/posts/destructuring-with-object-or-array
 */
export declare function hybridReturn<T extends Record<string, unknown>, A extends readonly any[]>(obj: T, arr: A): T & A;
/**
 * Just a simple sleep function. Allows to be more
 * easily auto-imported through the VSCode suggestions
 * since `setTimeout` import the non-awaitable version
 */
export declare function sleep(milliseconds: number | string): Promise<void>;
