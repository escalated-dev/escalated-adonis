/**
 * Exports the `resolve` and the reject methods as part of the
 * class public API.
 *
 * It allows resolving and rejecting promises outside of the
 * class constructor.
 */
export declare class Deferred<T> {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
}
