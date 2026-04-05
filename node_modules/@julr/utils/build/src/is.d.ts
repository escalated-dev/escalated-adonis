/**
 * Simplified version of https://github.com/sindresorhus/is since
 * I generally only use a few of the functions.
 */
import type { Class } from './types/index.js';
type Falsy = false | 0 | 0n | '' | null | undefined;
export declare function isBoolean(val: any): val is boolean;
export declare function isNumber(val: any): val is number;
export declare function isString(val: unknown): val is string;
export declare function isFunction(value: unknown): value is Function;
/**
 * Keep in mind arrays and functions are objects.
 * So maybe you want to use isPlainObject instead.
 */
export declare function isObject(value: unknown): value is object;
/**
 * Returns true if the value was creating using `{}`, `new Object()`, or `Object.create(null)`.
 */
export declare function isPlainObject<Value = unknown>(value: unknown): value is Record<PropertyKey, Value>;
export declare function isUndefined(value: unknown): value is undefined;
export declare function isNull(value: unknown): value is null;
export declare function isNullOrUndefined(value: unknown): value is null | undefined;
/**
 * Returns false if the value is false, 0, '', null, or undefined.
 */
export declare function isTruthy<T>(value: T | Falsy): value is T;
declare function isArray<T = unknown>(value: unknown, assertion?: (value: T) => value is T): value is T[];
declare function isClass<T = unknown>(value: unknown): value is Class<T>;
export declare function isPositiveNumber(value: unknown): value is number;
/**
 * Returns true if the value is false, 0, '', null, or undefined.
 */
export declare function isFalsy(value: unknown): value is Falsy;
export declare const is: {
    boolean: typeof isBoolean;
    number: typeof isNumber;
    string: typeof isString;
    function: typeof isFunction;
    object: typeof isObject;
    plainObject: typeof isPlainObject;
    undefined: typeof isUndefined;
    null: typeof isNull;
    nullOrUndefined: typeof isNullOrUndefined;
    truthy: typeof isTruthy;
    array: typeof isArray;
    class: typeof isClass;
    positiveNumber: typeof isPositiveNumber;
    falsy: typeof isFalsy;
};
export {};
