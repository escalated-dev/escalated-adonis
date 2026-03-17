/*
|--------------------------------------------------------------------------
| ImportContext
|--------------------------------------------------------------------------
|
| A lightweight singleton that signals when a bulk import is in progress.
| While active, domain event listeners (notifications, SLA timers, automations,
| escalation rules) should check `ImportContext.isImporting()` and skip their
| normal side-effects so that thousands of imported records don't trigger
| spurious emails, SLA breaches, etc.
|
| Usage in listeners / services:
|
|   import ImportContext from '#escalated/support/import_context'
|
|   if (ImportContext.isImporting()) return
|
| The ImportService wraps its entire run loop with `ImportContext.suppress()`.
|
*/

export default class ImportContext {
  private static _importing: boolean = false

  /**
   * Returns true while an import is actively running.
   */
  static isImporting(): boolean {
    return ImportContext._importing
  }

  /**
   * Run a callback with event suppression active.
   *
   * All Escalated domain events, notifications, SLA timers, and automations
   * are expected to check `ImportContext.isImporting()` and return early when
   * this is true.
   *
   * Suppression is always lifted in the `finally` block so a thrown error
   * cannot leave the flag stuck as `true`.
   */
  static async suppress<T>(callback: () => T | Promise<T>): Promise<T> {
    ImportContext._importing = true

    try {
      return await callback()
    } finally {
      ImportContext._importing = false
    }
  }
}
