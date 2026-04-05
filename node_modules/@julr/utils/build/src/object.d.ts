/**
 * Map over all the keys to create a new object.
 *
 * @example
 * ```ts
 * const products = { banana: 1.2, apple: 2.3, orange: 3.4 }
 * mapEntries(products, (key, value) => [key.toUpperCase(), value * 2])
 * // => { BANANA: 2.4, APPLE: 4.6, ORANGE: 6.8 }
 * ```
 */
export declare function mapEntries<TKey extends string | number | symbol, TValue, TNewKey extends string | number | symbol, TNewValue>(obj: Record<TKey, TValue>, toEntry: (key: TKey, value: TValue) => [TNewKey, TNewValue]): Record<TNewKey, TNewValue>;
/**
 * Map over all the keys of an object to return a new object.
 *
 * @example
 * ```ts
 * const a = { a: 1, b: 2, c: 3 }
 * mapKeys(a, (key, value) => key + value)
 * ```
 */
export declare function mapKeys<TValue, TKey extends string | number | symbol, TNewKey extends string | number | symbol>(obj: Record<TKey, TValue>, mapFunc: (key: TKey, value: TValue) => TNewKey): Record<TNewKey, TValue>;
/**
 * Map over all the keys to create a new object.
 *
 * @example
 * ```ts
 * const a = { a: 1, b: 2, c: 3 }
 * mapValues(a, (value, key) => value * 2)
 * ```
 */
export declare function mapValues<T extends object, U>(obj: T, mapFunc: (value: Required<T>[keyof T], key: keyof T) => U): {
    [K in keyof T]: U;
};
/**
 * Creates a new object composed of the picked object properties.
 *
 *
 * @example
 * const obj = { a: 1, b: 2, c: 3 };
 * const result = pick(obj, ['a', 'c']);
 * // result will be { a: 1, c: 3 }
 */
export declare function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K>;
/**
 * Creates a new object composed of the properties that satisfy the predicate function
 *
 * @example
 * const obj = { a: 1, b: 'pick', c: 3 };
 * const result = pickBy(obj, (value) => typeof value === 'string');
 * // result will be { b: 'pick' }
 */
export declare function pickBy<T extends Record<string, any>>(obj: T, shouldPick: (value: T[keyof T], key: keyof T) => boolean): Partial<T>;
/**
 * Creates a new object with specified keys omitted.
 */
export declare function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K>;
/**
 * Creates a new object composed of the properties that do not satisfy the predicate function
 */
export declare function omitBy<T extends Record<string, any>>(obj: T, shouldOmit: (value: T[keyof T], key: keyof T) => boolean): Partial<T>;
/**
 * Dynamically get a nested value from an array or object with a
 * string.
 *
 * @example
 * ```ts
 * const person = {
 *   name: 'John',
 *   friends: [{ name: 'Jane' }]
 * }
 *
 * get(person, 'friends[0].name')
 * // => 'Jane'
 * ```
 */
export declare function get<TDefault = unknown>(value: any, path: string, defaultValue?: TDefault): TDefault;
