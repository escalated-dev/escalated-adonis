import type { ArrayFlag, NumberFlag, StringFlag, BooleanFlag } from '../types.js';
/**
 * Namespace for defining flags using decorators.
 */
export declare const flags: {
    /**
     * Define option that accepts a string value
     */
    string<Type = string>(options?: Partial<Omit<StringFlag<Type>, "type">>): <Key extends string, Target extends { [K in Key]?: Type; }>(target: Target, propertyName: Key) => void;
    /**
     * Define option that accepts a boolean value
     */
    boolean<Type = boolean>(options?: Partial<Omit<BooleanFlag<Type>, "type">>): <Key extends string, Target extends { [K in Key]?: Type; }>(target: Target, propertyName: Key) => void;
    /**
     * Define option that accepts a number value
     */
    number<Type = number>(options?: Partial<Omit<NumberFlag<Type>, "type">>): <Key extends string, Target extends { [K in Key]?: Type; }>(target: Target, propertyName: Key) => void;
    /**
     * Define option that accepts an array of values
     */
    array<Type extends any[] = string[]>(options?: Partial<Omit<ArrayFlag<Type>, "type">>): <Key extends string, Target extends { [K in Key]?: Type; }>(target: Target, propertyName: Key) => void;
};
