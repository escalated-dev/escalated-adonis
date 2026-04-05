// src/runner.ts
import { debuglog } from "util";
var debug = debuglog("poppinss:hooks");
var Runner = class {
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
  constructor(action, hookHandlers) {
    this.action = action;
    this.#hookHandlers = hookHandlers || /* @__PURE__ */ new Set();
  }
  /**
   * A collection of registered hook handlers
   */
  #hookHandlers;
  /**
   * Cleanup handlers should always be an array of functions. Using a set will
   * discard duplicates and it is very much possible for two hooks to return
   * a shared cleanup handler.
   */
  #cleanupHandlers = [];
  /**
   * State to perform the cleanup
   */
  #state = "idle";
  /**
   * A collection of handlers to ignore when executed them
   */
  #handlersToIgnore = [];
  /**
   * Whether or not to skip all the hooks
   */
  #skipAllHooks = false;
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
  get isCleanupPending() {
    return this.#state === "cleanup_pending";
  }
  /**
   * Filter to check if we should run the handler
   *
   * @param handlerName - The name of the handler to check
   */
  #filter(handlerName) {
    return !this.#handlersToIgnore.includes(handlerName);
  }
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
  without(handlersToIgnore) {
    if (!handlersToIgnore) {
      debug("skipping all hooks");
      this.#skipAllHooks = true;
    } else {
      this.#skipAllHooks = false;
      debug("skipping %O hooks", handlersToIgnore);
      this.#handlersToIgnore = handlersToIgnore;
    }
    return this;
  }
  /**
   * Executing hooks
   *
   * @param reverse - Whether to execute handlers in reverse order
   * @param data - Arguments to pass to the hook handlers
   */
  async #exec(reverse, data) {
    if (this.#state !== "idle") {
      return;
    }
    this.#state = "cleanup_pending";
    if (this.#skipAllHooks) {
      return;
    }
    debug("running hooks");
    const handlers = reverse ? Array.from(this.#hookHandlers).reverse() : this.#hookHandlers;
    for (let handler of handlers) {
      if (this.#filter(handler.name)) {
        if (handler.name) {
          debug("running hook %s", handler.name);
        }
        const result = await (typeof handler === "function" ? handler(...data) : handler.handle(this.action, ...data));
        if (typeof result === "function") {
          if (handler.name) {
            debug("cleanup scheduled by %s hook", handler.name);
          }
          this.#cleanupHandlers.push(result);
        }
      }
    }
  }
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
  async run(...data) {
    return this.#exec(false, data);
  }
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
  async runReverse(...data) {
    return this.#exec(true, data);
  }
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
  async cleanup(...data) {
    if (!this.isCleanupPending) {
      return;
    }
    this.#state = "cleanup_initiated";
    debug("performing cleanup");
    let startIndex = this.#cleanupHandlers.length;
    while (startIndex--) {
      await this.#cleanupHandlers[startIndex](...data);
    }
    this.#state = "cleanup_completed";
    this.#cleanupHandlers = [];
  }
};

// src/hooks.ts
var Hooks = class {
  /**
   * A collection of registered hooks
   */
  #hooks = /* @__PURE__ */ new Map();
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
  all() {
    return this.#hooks;
  }
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
  has(event, handler) {
    const handlers = this.#hooks.get(event);
    if (!handlers) {
      return false;
    }
    if (handler) {
      return handlers.has(handler);
    }
    return true;
  }
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
  add(event, handler) {
    const handlers = this.#hooks.get(event);
    if (!handlers) {
      this.#hooks.set(event, /* @__PURE__ */ new Set());
    }
    this.#hooks.get(event).add(handler);
    return this;
  }
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
  remove(event, handler) {
    const handlers = this.#hooks.get(event);
    if (!handlers) {
      return false;
    }
    return handlers.delete(handler);
  }
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
  clear(event) {
    if (!event) {
      this.#hooks.clear();
      return;
    }
    this.#hooks.delete(event);
  }
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
  merge(hooks) {
    hooks.all().forEach((actionHooks, action) => {
      actionHooks.forEach((handler) => {
        this.add(action, handler);
      });
    });
  }
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
  runner(action) {
    return new Runner(action, this.#hooks.get(action));
  }
};
export {
  Hooks as default
};
