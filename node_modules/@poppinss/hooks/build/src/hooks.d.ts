import { Runner } from './runner.js';
import { type HookHandler, type HookHandlerProvider } from './types.js';
/**
 * Quite simple implementation register lifecycle hooks around specific events.
 *
 * @example
 * ```ts
 * const hooks = new Hooks()
 *
 * hooks.add('saving', function hashPassword(entity) {
 * })
 * ```
 */
export declare class Hooks<Events extends Record<string, [any[], any[]]>> {
    #private;
    /**
     * Get access to all the registered hooks. The return value is
     * a map of the event name and a set of handlers.
     *
     * @example
     * ```ts
     * const hooks = new Hooks()
     * const allHooks = hooks.all()
     * console.log(allHooks.size) // Number of events with handlers
     * ```
     */
    all(): { [Event in keyof Events]: Map<Event, Set<HookHandler<Events[Event][0], Events[Event][1]> | HookHandlerProvider<Events[Event][0], Events[Event][1]>>>; }[keyof Events];
    /**
     * Find if a handler for a given event exists.
     *
     * @param event - The event name to check
     * @param handler - Optional specific handler to check for
     *
     * @example
     * ```ts
     * const hooks = new Hooks()
     *
     * // Check if any handlers exist for an event
     * if (hooks.has('saving')) {
     *   console.log('Saving hooks are registered')
     * }
     *
     * // Check if specific handler exists
     * if (hooks.has('saving', hashPasswordHandler)) {
     *   console.log('Hash password handler is registered')
     * }
     * ```
     */
    has<Event extends keyof Events>(event: Event, handler?: HookHandler<Events[Event][0], Events[Event][1]> | HookHandlerProvider<Events[Event][0], Events[Event][1]>): boolean;
    /**
     * Add a hook handler for a given event. Adding the same handler twice will
     * result in a noop.
     *
     * @param event - The event name to add the handler for
     * @param handler - The hook handler function or handler provider
     *
     * @example
     * ```ts
     * const hooks = new Hooks()
     *
     * // Add a function handler
     * hooks.add('saving', function hashPassword(user) {
     *   user.password = hash(user.password)
     * })
     *
     * // Add a handler provider
     * hooks.add('saving', {
     *   name: 'EmailValidator',
     *   handle(event, user) {
     *     validateEmail(user.email)
     *   }
     * })
     * ```
     */
    add<Event extends keyof Events>(event: Event, handler: HookHandler<Events[Event][0], Events[Event][1]> | HookHandlerProvider<Events[Event][0], Events[Event][1]>): this;
    /**
     * Remove hook handler for a given event.
     *
     * @param event - The event name to remove the handler from
     * @param handler - The hook handler to remove
     *
     * @example
     * ```ts
     * const hooks = new Hooks()
     * const handler = function hashPassword(user) {}
     *
     * hooks.add('saving', handler)
     *
     * // Later, remove the handler
     * const removed = hooks.remove('saving', handler)
     * console.log(removed) // true if handler was found and removed
     * ```
     */
    remove<Event extends keyof Events>(event: Event, handler: HookHandler<Events[Event][0], Events[Event][1]> | HookHandlerProvider<Events[Event][0], Events[Event][1]>): boolean;
    /**
     * Clear all the hooks for a specific event or all the
     * events.
     *
     * @param event - Optional event name to clear hooks for. If not provided, clears all hooks.
     *
     * @example
     * ```ts
     * const hooks = new Hooks()
     *
     * // Clear hooks for specific event
     * hooks.clear('saving')
     *
     * // Clear all hooks
     * hooks.clear()
     * ```
     */
    clear(event?: keyof Events): void;
    /**
     * Merge hooks from an existing hooks instance.
     *
     * @param hooks - The hooks instance to merge from
     *
     * @example
     * ```ts
     * const hooks1 = new Hooks()
     * const hooks2 = new Hooks()
     *
     * hooks2.add('saving', handler1)
     * hooks2.add('deleting', handler2)
     *
     * // Merge hooks2 into hooks1
     * hooks1.merge(hooks2)
     * ```
     */
    merge(hooks: Hooks<Events>): void;
    /**
     * Returns an instance of the runner to run hooks
     *
     * @param action - The event name to create a runner for
     *
     * @example
     * ```ts
     * const hooks = new Hooks()
     *
     * hooks.add('saving', function hashPassword(user) {
     *   user.password = hash(user.password)
     * })
     *
     * // Get a runner and execute hooks
     * const runner = hooks.runner('saving')
     * await runner.run(user)
     * ```
     */
    runner<Event extends Extract<keyof Events, string>>(action: Event): Runner<Events[Event][0], Events[Event][1]>;
}
