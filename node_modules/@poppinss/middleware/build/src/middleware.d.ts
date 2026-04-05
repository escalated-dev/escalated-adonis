import { Runner } from './runner.ts';
/**
 * The middleware class implements the chain of responsibility design pattern
 * and allows executing handlers in series.
 */
export declare class Middleware<MiddlewareFn extends any> {
    #private;
    /**
     * Get access to all the registered middleware. The return value is
     * a set of handlers.
     */
    all(): Set<MiddlewareFn>;
    /**
     * Find if a handler has been registered as a middleware
     * already.
     */
    has(handler: MiddlewareFn): boolean;
    /**
     * Add a middleware. Adding the same middleware
     * twice will result in a noop.
     */
    add(handler: MiddlewareFn): this;
    /**
     * Remove a specific middleware
     */
    remove(handler: MiddlewareFn): boolean;
    /**
     * Remove all middleware
     */
    clear(): void;
    /**
     * Merge middleware from a existing middleware
     * instance. The merged middleware are
     * appended
     */
    merge(hooks: Middleware<MiddlewareFn>): void;
    /**
     * Freezes the middleware stack for further modifications
     */
    freeze(): void;
    /**
     * Returns an instance of the runner to run hooks
     */
    runner(): Runner<MiddlewareFn>;
}
