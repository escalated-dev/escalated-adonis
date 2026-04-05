/**
 * Converts a value to an array. If the value is already an array, it is returned as is
 */
export declare function toArray<T>(value: T | T[]): T[];
/**
 * Returns a new array containing only the unique elements from the original array,
 * based on the values returned by the mapper function.
 */
export declare function uniqBy<T, U>(arr: readonly T[], mapper: (item: T) => U): T[];
/**
 * Creates a duplicate-free version of an array.
 */
export declare function uniq<T>(arr: readonly T[]): T[];
/**
 * Pick a random element from the array
 */
export declare function draw<T>(arr: readonly T[]): T;
