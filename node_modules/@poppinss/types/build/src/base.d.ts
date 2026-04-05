export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
/**
 * Primitive values
 */
export type Primitive = null | undefined | string | number | boolean | symbol | bigint;
/**
 * Accept one or more of the mentioned type
 */
export type OneOrMore<T> = T | T[];
/**
 * Representation of a class constructor
 */
export type Constructor<T, Arguments extends unknown[] = any[]> = new (...args: Arguments) => T;
/**
 * Representation of an abstract class constructor
 */
export type AbstractConstructor<T, Arguments extends unknown[] = any[]> = abstract new (...args: Arguments) => T;
/**
 * A function that lazily imports a module with default export.
 */
export type LazyImport<DefaultExport> = () => Promise<{
    default: DefaultExport;
}>;
/**
 * Unwraps default export from a lazy import function
 */
export type UnWrapLazyImport<Fn extends LazyImport<any>> = Awaited<ReturnType<Fn>>['default'];
/**
 * Normalizes constructor to work with mixins. There is an open bug for mixins
 * to allow constructors other than `...args: any[]`
 *
 * https://github.com/microsoft/TypeScript/issues/37142
 */
export type NormalizeConstructor<T extends Constructor<any>> = Omit<T, 'constructor'> & {
    new (...args: any[]): InstanceType<T>;
};
/**
 * Create a branded Opaque type for a value. For example
 *
 * type Username = Opaque<string, 'username'>
 * type Password = Opaque<string, 'password'>
 *
 * function checkUser(username: Username) {}
 *
 * const username: Username = 'virk'
 * const password: Password = 'secret'
 *
 * checkUser(username) // ✅
 * checkUser(password) // ❌
 */
declare const opaqueProp: unique symbol;
export type Opaque<T, K> = T & {
    [opaqueProp]: K;
};
export type UnwrapOpaque<T> = T extends Opaque<infer A, any> ? A : never;
/**
 * Extract functions from an object or class instance
 */
export type ExtractFunctions<T, IgnoreList extends keyof T = never> = {
    [P in keyof T]: P extends IgnoreList ? never : T[P] extends (...args: any[]) => any ? P : never;
}[keyof T];
/**
 * Check of all the values of an object are optional.
 */
export type AreAllOptional<T> = keyof T extends never ? true : {
    [K in keyof T]-?: [undefined] extends [T[K]] ? never : K;
}[keyof T] extends never ? true : false;
/**
 * Returns a union of properties that could be undefined
 */
export type ExtractUndefined<T> = {
    [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];
/**
 * Returns a union of properties that will never be undefined
 */
export type ExtractDefined<T> = {
    [K in keyof T]: undefined extends T[K] ? never : K;
}[keyof T];
/**
 * Returns a union of T or PromiseLike<T>
 */
export type AsyncOrSync<T> = PromiseLike<T> | T;
/**
 * Marks nested properties as partial
 */
export type DeepPartial<T> = Prettify<{
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}>;
export {};
