/**
 * Promise or maybe not
 */
export type Awaitable<T> = T | PromiseLike<T>;
/**
 * Array or maybe not
 */
export type Arrayable<T> = T | Array<T>;
/**
 * A function that may return a promise.
 */
export type AwaitableFn<Args extends unknown[] = unknown[], Result = void> = Fn<Awaitable<Result>, Args>;
/**
 * Null or whatever
 */
export type Nullable<T> = T | null | undefined;
/**
 * Function. I personally prefer this syntax over the native `Function` type.
 */
export type Fn<Result = void, Args extends unknown[] = unknown[]> = (...args: Args) => Result;
/**
 * Constructor type.
 */
export type Constructor<T = any, Arguments extends unknown[] = any[]> = new (...args: Arguments) => T;
/**
 * A class type.
 */
export type Class<T, Arguments extends unknown[] = any[]> = {
    prototype: Pick<T, keyof T>;
    new (...args: Arguments): T;
};
/**
 * Prettify a type.
 *
 * See https://www.totaltypescript.com/concepts/the-prettify-helper
 */
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
/**
 * Return type of a function. Can be more concise than the native ReturnType since it support
 * promises.
 */
export type ReturnType<T extends ((...args: any[]) => unknown) | undefined | null | false | ''> = T extends (...args: any[]) => infer R ? (R extends PromiseLike<infer J> ? J : R) : never;
