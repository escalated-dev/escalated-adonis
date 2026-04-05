import type { ErrorHandler, Executor, FinalHandler } from './types.ts';
/**
 * Runnable to execute an array of functions in sequence. The queue is
 * advanced only when the current function calls `next`.
 *
 * ```js
 * const runner = new Runnable([async function fn1 (params, next) {
 * }])
 * ```
 */
export declare class Runner<MiddlewareFn extends any> {
    #private;
    constructor(middleware: MiddlewareFn[]);
    /**
     * Final handler to be executed, when the chain ends successfully.
     */
    finalHandler(finalHandler: FinalHandler): this;
    /**
     * Specify a custom error handler to use. Defining an error handler
     * turns will make run method not throw an exception and instead
     * run the upstream middleware logic
     */
    errorHandler(errorHandler: ErrorHandler): this;
    /**
     * Start the middleware queue and pass params to it. The `params`
     * array will be passed as spread arguments.
     */
    run(cb: Executor<MiddlewareFn>): Promise<void>;
}
