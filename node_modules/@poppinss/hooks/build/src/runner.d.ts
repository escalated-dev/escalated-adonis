import { type HookHandler, type HookHandlerProvider } from './types.js';
/**
 * Runner allows running a set of specific hook handlers for a given
 * event. You can grab the instance of the runner using the "hook.runner" method.
 *
 * ```ts
 * const hooks = new Hooks()
 *
 * await hooks.runner('saving').run()
 * ```
 */
export declare class Runner<HookArgs extends any[], CleanUpArgs extends any[]> {
    #private;
    action: string;
    /**
     * Find if cleanup is pending or not
     *
     * @example
     * ```ts
     * const runner = hooks.runner('saving')
     * await runner.run()
     *
     * if (runner.isCleanupPending) {
     *   await runner.cleanup()
     * }
     * ```
     */
    get isCleanupPending(): boolean;
    /**
     * Create a new Runner instance
     *
     * @param action - The name of the event/action this runner handles
     * @param hookHandlers - Optional set of hook handlers to initialize with
     *
     * @example
     * ```ts
     * const runner = new Runner('saving', new Set([handler1, handler2]))
     * ```
     */
    constructor(action: string, hookHandlers?: Set<HookHandler<HookArgs, CleanUpArgs> | HookHandlerProvider<HookArgs, CleanUpArgs>>);
    /**
     * Ignore specific or all hook handlers. Calling this
     * method multiple times will result in overwriting
     * the existing state.
     *
     * @param handlersToIgnore - Array of handler names to ignore, or undefined to skip all hooks
     *
     * @example
     * ```ts
     * // Skip specific handlers
     * runner.without(['hashPassword', 'validateEmail']).run()
     *
     * // Skip all handlers
     * runner.without().run()
     * ```
     */
    without(handlersToIgnore?: string[]): this;
    /**
     * Execute handlers
     *
     * @param data - Arguments to pass to the hook handlers
     *
     * @example
     * ```ts
     * const runner = hooks.runner('saving')
     * await runner.run(user, { email: 'new@example.com' })
     * ```
     */
    run(...data: HookArgs): Promise<void>;
    /**
     * Execute handlers in reverse order
     *
     * @param data - Arguments to pass to the hook handlers
     *
     * @example
     * ```ts
     * const runner = hooks.runner('deleting')
     * await runner.runReverse(user)
     * ```
     */
    runReverse(...data: HookArgs): Promise<void>;
    /**
     * Execute cleanup actions
     *
     * @param data - Arguments to pass to the cleanup handlers
     *
     * @example
     * ```ts
     * const runner = hooks.runner('saving')
     * await runner.run(user)
     *
     * // Later, cleanup any resources
     * await runner.cleanup(user)
     * ```
     */
    cleanup(...data: CleanUpArgs): Promise<void>;
}
