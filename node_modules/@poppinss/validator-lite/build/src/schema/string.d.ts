import type { StringFnOptions } from '../types.js';
/**
 * Enforces the value to exist and be of type string
 */
export declare function string(options?: StringFnOptions): (key: string, value?: string) => string;
export declare namespace string {
    var optional: (options?: StringFnOptions) => (key: string, value?: string) => string | undefined;
    var optionalWhen: (condition: boolean | ((key: string, value?: string) => boolean), options?: StringFnOptions) => (key: string, value?: string) => string | undefined;
}
