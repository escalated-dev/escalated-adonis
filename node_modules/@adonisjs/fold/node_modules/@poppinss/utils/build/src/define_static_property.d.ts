import type { AbstractConstructor, Constructor } from '@poppinss/types';
/**
 * Define static properties on a class with inheritance in play.
 */
export declare function defineStaticProperty<T extends Constructor<any> | AbstractConstructor<any>, Prop extends keyof T>(self: T, propertyName: Prop, { initialValue, strategy, }: {
    initialValue: T[Prop];
    strategy: 'inherit' | 'define' | ((value: T[Prop]) => T[Prop]);
}): void;
