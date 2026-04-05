import type { SchemaFnOptions } from '../types.js';
/**
 * Enforces value to be one of the defined choices
 */
export declare function oneOf<K extends any>(choices: readonly K[], options?: SchemaFnOptions): (key: string, value?: string) => K;
export declare namespace oneOf {
    var optional: <K extends unknown>(choices: readonly K[], options?: SchemaFnOptions) => (key: string, value?: string) => K | undefined;
    var optionalWhen: <K extends unknown>(condition: boolean | ((key: string, value?: string) => boolean), choices: readonly K[], options?: SchemaFnOptions) => (key: string, value?: string) => K | undefined;
}
