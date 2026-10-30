import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Re-entrancy guard for plugin actions, after the workflow engine's.
 *
 * Plugin ctx writes go through TicketService, so they raise canonical events
 * while the plugin that wrote is still handling its own action. A
 * ticket.created handler that opens a ticket would otherwise hand itself
 * ticket.created without end. While an action is being delivered to plugins,
 * the same action is not delivered again, and nesting stops at MAX_DEPTH.
 * Webhooks and workflows still see every event; only plugin delivery is
 * skipped.
 *
 * The chain lives in the async context, so it follows a delivery that is
 * deferred (setImmediate) after the write that raised it.
 */
export const MAX_PLUGIN_ACTION_DEPTH = 3

const running = new AsyncLocalStorage<string[]>()

/** Runs `deliver` for `name` unless it is already being delivered. Resolves to whether it ran. */
export async function guardPluginAction(
  name: string,
  deliver: () => Promise<unknown>
): Promise<boolean> {
  const chain = running.getStore() ?? []
  if (chain.includes(name) || chain.length >= MAX_PLUGIN_ACTION_DEPTH) {
    console.debug(
      `[Escalated] plugin action "${name}" skipped: raised while [${chain.join(', ')}] run`
    )
    return false
  }
  await running.run([...chain, name], deliver)
  return true
}
