import type { SpreadArgument, StringArgument } from '../types.js';
/**
 * Namespace for defining arguments using decorators.
 */
export declare const args: {
    /**
     * Define argument that accepts a string value
     */
    string<Type = string>(options?: Partial<Omit<StringArgument<Type>, "type">>): <Key extends string, Target extends { [K in Key]?: Type; }>(target: Target, propertyName: Key) => void;
    /**
     * Define argument that accepts a spread value
     */
    spread<Type extends unknown = string[]>(options?: Partial<Omit<SpreadArgument<Type>, "type">>): <Key extends string, Target extends { [K in Key]?: Type; }>(target: Target, propertyName: Key) => void;
};
