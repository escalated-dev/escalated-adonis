import type { SchemaFnOptions } from '../types.js';
/**
 * Enforces the value to be of type boolean. Also casts
 * string representation of a boolean to a boolean
 * type
 */
export declare function boolean(options?: SchemaFnOptions): (key: string, value?: string) => boolean;
export declare namespace boolean {
    var optional: (options?: SchemaFnOptions) => (key: string, value?: string) => boolean | undefined;
    var optionalWhen: (condition: boolean | ((key: string, value?: string) => boolean), options?: SchemaFnOptions) => (key: string, value?: string) => boolean | undefined;
}
