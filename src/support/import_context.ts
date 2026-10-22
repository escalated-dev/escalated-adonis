/*
|--------------------------------------------------------------------------
| ImportContext
|--------------------------------------------------------------------------
|
| Signals that a bulk import is in progress. While active, domain event
| listeners (notifications, SLA timers, automations, escalation rules) check
| `ImportContext.isImporting()` and skip their normal side-effects so that
| thousands of imported records don't trigger spurious emails, SLA breaches,
| etc. This is escalated-laravel's ImportContext.
|
| Usage in listeners / services:
|
|   import ImportContext from '#escalated/support/import_context'
|
|   if (ImportContext.isImporting()) return
|
| The ImportService wraps its entire run loop with `ImportContext.suppress()`.
|
| The flag lives in the import's own async context (AsyncLocalStorage), not
| in a process-wide variable. Laravel's static flag is safe because its
| imports run in a queue worker; here the run shares the process with live
| requests, and a global flag held for the length of an import silenced
| their notifications, SLA clocks and webhooks too.
|
*/

import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage<true>()

export default class ImportContext {
  /**
   * Returns true inside a `suppress()` callback, including everything it
   * awaits.
   */
  static isImporting(): boolean {
    return storage.getStore() === true
  }

  /**
   * Run a callback with event suppression active.
   *
   * All Escalated domain events, notifications, SLA timers, and automations
   * are expected to check `ImportContext.isImporting()` and return early when
   * this is true. Suppression ends with the callback, even when it throws.
   */
  static async suppress<T>(callback: () => T | Promise<T>): Promise<T> {
    return storage.run(true, async () => await callback())
  }
}
