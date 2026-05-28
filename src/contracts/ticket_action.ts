/*
|--------------------------------------------------------------------------
| Ticket Action contract
|--------------------------------------------------------------------------
|
| Host applications register custom ticket actions on `config/escalated.ts`
| under `ticketActions.actions` — either objects implementing TicketAction or
| plain TicketActionConfig objects. Each visible action renders as a button on
| the agent ticket screen; triggering it emits the
| `escalated:ticket:customActionTriggered` event.
|
*/

export interface TicketAction {
  /** Stable identifier, used in the action URL and the emitted event. */
  key(): string

  /** Button label shown to the agent. */
  label(ticket: any, user: any): string

  /** Whether the action appears at all for this ticket/user. */
  visible(ticket: any, user: any): boolean

  /** Whether the button is clickable (vs. shown but disabled). */
  enabled(ticket: any, user: any): boolean

  /** Button style: 'primary' | 'secondary' | 'danger'. */
  variant(): string

  /** Optional confirmation prompt shown before the action fires. */
  confirmation(ticket: any, user: any): string | null

  /** Arbitrary metadata passed through to the UI and the event (e.g. icon). */
  metadata(ticket: any, user: any): Record<string, any>
}

/** A value, or a function resolving it lazily from the ticket/user. */
export type TicketActionValueOrFn<T> = T | ((ticket: any, user: any) => T)

/** Plain-object form of a ticket action, resolved into a TicketAction by the registry. */
export interface TicketActionConfig {
  key: string
  label: TicketActionValueOrFn<string>
  variant?: string
  visible?: TicketActionValueOrFn<boolean>
  enabled?: TicketActionValueOrFn<boolean>
  confirmation?: TicketActionValueOrFn<string | null>
  metadata?: TicketActionValueOrFn<Record<string, any>>
}

/** Type guard: does the value already implement TicketAction? */
export function isTicketAction(value: TicketAction | TicketActionConfig): value is TicketAction {
  return typeof (value as TicketAction).key === 'function'
}
