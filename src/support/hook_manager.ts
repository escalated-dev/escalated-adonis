/*
|--------------------------------------------------------------------------
| HookManager
|--------------------------------------------------------------------------
|
| WordPress-style actions and filters with priority-based execution.
| Actions fire side effects; filters transform values through a pipeline.
|
*/

type ActionCallback = (...args: any[]) => void | Promise<void>
type FilterCallback = (value: any, ...args: any[]) => any | Promise<any>

interface RegisteredCallback<T> {
  callback: T
  priority: number
}

export default class HookManager {
  protected actions: Map<string, RegisteredCallback<ActionCallback>[]> = new Map()
  protected filters: Map<string, RegisteredCallback<FilterCallback>[]> = new Map()

  // ---- Actions ----

  /**
   * Register a callback for an action hook.
   *
   * @param tag - The action name (e.g. 'ticket_created')
   * @param callback - The function to call when the action fires
   * @param priority - Lower numbers run first (default 10)
   */
  addAction(tag: string, callback: ActionCallback, priority: number = 10): void {
    const existing = this.actions.get(tag) ?? []
    existing.push({ callback, priority })
    this.actions.set(tag, existing)
  }

  /**
   * Execute all callbacks registered for an action, in priority order.
   *
   * @param tag - The action name
   * @param args - Arguments forwarded to every callback
   */
  async doAction(tag: string, ...args: any[]): Promise<void> {
    const registered = this.actions.get(tag)
    if (!registered || registered.length === 0) {
      return
    }

    // Sort by priority (lower first), stable sort preserves insertion order
    const sorted = [...registered].sort((a, b) => a.priority - b.priority)

    for (const entry of sorted) {
      await entry.callback(...args)
    }
  }

  /**
   * Check whether any callbacks are registered for an action.
   */
  hasAction(tag: string): boolean {
    const registered = this.actions.get(tag)
    return !!registered && registered.length > 0
  }

  /**
   * Remove action callbacks. If `callback` is provided, only that specific
   * callback is removed. If `callback` is omitted, all callbacks for the
   * tag are removed.
   */
  removeAction(tag: string, callback?: ActionCallback): void {
    if (!callback) {
      this.actions.delete(tag)
      return
    }

    const registered = this.actions.get(tag)
    if (!registered) {
      return
    }

    const filtered = registered.filter((entry) => entry.callback !== callback)
    if (filtered.length === 0) {
      this.actions.delete(tag)
    } else {
      this.actions.set(tag, filtered)
    }
  }

  // ---- Filters ----

  /**
   * Register a callback for a filter hook.
   *
   * @param tag - The filter name (e.g. 'ticket_display_subject')
   * @param callback - Receives the current value as the first arg, returns the transformed value
   * @param priority - Lower numbers run first (default 10)
   */
  addFilter(tag: string, callback: FilterCallback, priority: number = 10): void {
    const existing = this.filters.get(tag) ?? []
    existing.push({ callback, priority })
    this.filters.set(tag, existing)
  }

  /**
   * Run a value through all registered filter callbacks in priority order.
   *
   * @param tag - The filter name
   * @param value - The initial value to filter
   * @param args - Additional arguments forwarded to every callback
   * @returns The final filtered value
   */
  async applyFilters<T = any>(tag: string, value: T, ...args: any[]): Promise<T> {
    const registered = this.filters.get(tag)
    if (!registered || registered.length === 0) {
      return value
    }

    const sorted = [...registered].sort((a, b) => a.priority - b.priority)

    let result: any = value
    for (const entry of sorted) {
      result = await entry.callback(result, ...args)
    }

    return result as T
  }

  /**
   * Check whether any callbacks are registered for a filter.
   */
  hasFilter(tag: string): boolean {
    const registered = this.filters.get(tag)
    return !!registered && registered.length > 0
  }

  /**
   * Remove filter callbacks. If `callback` is provided, only that specific
   * callback is removed. If `callback` is omitted, all callbacks for the
   * tag are removed.
   */
  removeFilter(tag: string, callback?: FilterCallback): void {
    if (!callback) {
      this.filters.delete(tag)
      return
    }

    const registered = this.filters.get(tag)
    if (!registered) {
      return
    }

    const filtered = registered.filter((entry) => entry.callback !== callback)
    if (filtered.length === 0) {
      this.filters.delete(tag)
    } else {
      this.filters.set(tag, filtered)
    }
  }

  // ---- Introspection ----

  /**
   * Get all registered action tags and their callback counts.
   */
  getActions(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [tag, callbacks] of this.actions) {
      result[tag] = callbacks.length
    }
    return result
  }

  /**
   * Get all registered filter tags and their callback counts.
   */
  getFilters(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [tag, callbacks] of this.filters) {
      result[tag] = callbacks.length
    }
    return result
  }

  /**
   * Remove all registered actions and filters.
   * Useful for testing.
   */
  clear(): void {
    this.actions.clear()
    this.filters.clear()
  }
}
