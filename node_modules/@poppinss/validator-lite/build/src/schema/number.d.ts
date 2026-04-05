import type { SchemaFnOptions } from '../types.js';
/**
 * Casts the string to a number and ensures it is no NaN
 */
export declare function castToNumber(key: string, value: string, message?: string): number;
/**
 * Enforces the value to be of valid number type and the
 * value will also be casted to a number
 */
export declare function number(options?: SchemaFnOptions): (key: string, value?: string) => number;
export declare namespace number {
    var optional: (options?: SchemaFnOptions) => (key: string, value?: string) => number | undefined;
    var optionalWhen: (condition: boolean | ((key: string, value?: string) => boolean), options?: SchemaFnOptions) => (key: string, value?: string) => number | undefined;
}
