import type { Awaitable, Fn, Nullable } from './types/index.js';
/**
 * Creates a function that is restricted to invoking the provided function `func` once.
 * Repeated calls to the function will return the value from the first invocation.
 */
export declare function once<F extends () => any>(func: F): F;
export declare function once<F extends (...args: any[]) => void>(func: F): F;
/**
 * A no-operation function that does nothing.
 * This can be used as a placeholder or default function.
 */
export declare function noop(): void;
/**
 * An asynchronous no-operation function that does nothing.
 * This can be used as a placeholder or default function.
 */
export declare function asyncNoop(): Promise<void>;
/**
 * Just call the function.
 */
export declare function invoke(fn: undefined): undefined;
export declare function invoke<T>(fn: Fn<T>): T;
/**
 * Call every function in an array
 */
export declare function batchInvoke(functions: Nullable<Fn>[]): void;
/**
 * Asynchronously tries the specified promise.
 */
export declare function tryAsync<T>(fn: Fn<Awaitable<T>>): Promise<[T, null] | [null, Error]>;
