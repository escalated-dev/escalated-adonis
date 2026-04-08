import type Ticket from '../models/ticket.js'
import type Reply from '../models/reply.js'
import type { TicketStatus, TicketPriority } from '../types.js'

/**
 * Configuration for the broadcast service.
 */
export interface BroadcastConfig {
  enabled: boolean
  driver: 'transmit' | 'ws' | 'custom'
  events: {
    ticketCreated: boolean
    ticketUpdated: boolean
    ticketStatusChanged: boolean
    ticketAssigned: boolean
    ticketPriorityChanged: boolean
    replyCreated: boolean
    internalNoteAdded: boolean
  }
}

/**
 * A broadcast channel definition.
 */
export interface BroadcastChannel {
  name: string
  authorize: (user: any) => boolean | Promise<boolean>
}

/**
 * Payload sent over broadcast channels.
 */
export interface BroadcastPayload {
  event: string
  channel: string
  data: Record<string, any>
  timestamp: string
}

/**
 * Default broadcast configuration.
 */
export function getDefaultBroadcastConfig(): BroadcastConfig {
  return {
    enabled: false,
    driver: 'transmit',
    events: {
      ticketCreated: true,
      ticketUpdated: true,
      ticketStatusChanged: true,
      ticketAssigned: true,
      ticketPriorityChanged: true,
      replyCreated: true,
      internalNoteAdded: false,
    },
  }
}

/**
 * BroadcastService handles real-time event broadcasting.
 *
 * Events are opt-in via configuration. The service builds channel names,
 * authorizes users, and dispatches payloads to the configured transport.
 */
export default class BroadcastService {
  protected config: BroadcastConfig
  protected transport: ((channel: string, event: string, data: any) => void | Promise<void>) | null

  constructor(
    config?: Partial<BroadcastConfig>,
    transport?: (channel: string, event: string, data: any) => void | Promise<void>
  ) {
    this.config = { ...getDefaultBroadcastConfig(), ...config }
    this.transport = transport ?? null
  }

  /**
   * Check if broadcasting is enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Check if a specific event type is enabled for broadcasting.
   */
  isEventEnabled(eventName: keyof BroadcastConfig['events']): boolean {
    return this.config.enabled && (this.config.events[eventName] ?? false)
  }

  // ---- Channel Names ----

  /**
   * Get the channel name for a specific ticket.
   */
  ticketChannel(ticketId: number): string {
    return `escalated.ticket.${ticketId}`
  }

  /**
   * Get the global agent dashboard channel.
   */
  agentDashboardChannel(): string {
    return 'escalated.agents'
  }

  /**
   * Get the channel for a department.
   */
  departmentChannel(departmentId: number): string {
    return `escalated.department.${departmentId}`
  }

  /**
   * Get the channel for a specific user's personal notifications.
   */
  userChannel(userId: number): string {
    return `escalated.user.${userId}`
  }

  // ---- Authorization ----

  /**
   * Build channel authorization rules.
   */
  getChannelAuthorizations(authConfig: {
    isAgent: (user: any) => boolean | Promise<boolean>
    isAdmin: (user: any) => boolean | Promise<boolean>
  }): BroadcastChannel[] {
    return [
      {
        name: 'escalated.agents',
        authorize: async (user: any) => {
          const isAgent = await authConfig.isAgent(user)
          const isAdmin = await authConfig.isAdmin(user)
          return isAgent || isAdmin
        },
      },
      {
        name: 'escalated.ticket.*',
        authorize: async (user: any) => {
          const isAgent = await authConfig.isAgent(user)
          const isAdmin = await authConfig.isAdmin(user)
          return isAgent || isAdmin
        },
      },
      {
        name: 'escalated.department.*',
        authorize: async (user: any) => {
          const isAgent = await authConfig.isAgent(user)
          const isAdmin = await authConfig.isAdmin(user)
          return isAgent || isAdmin
        },
      },
      {
        name: 'escalated.user.*',
        authorize: (user: any) => {
          // Users can only listen to their own channel
          // The channel name contains the user ID; actual matching is
          // done by the caller comparing user.id with the channel param.
          return !!user
        },
      },
    ]
  }

  // ---- Broadcasting ----

  /**
   * Broadcast a ticket created event.
   */
  async broadcastTicketCreated(ticket: Ticket): Promise<void> {
    if (!this.isEventEnabled('ticketCreated')) return

    const data = this.serializeTicket(ticket)

    await this.broadcast(this.agentDashboardChannel(), 'ticket.created', data)
    if (ticket.departmentId) {
      await this.broadcast(this.departmentChannel(ticket.departmentId), 'ticket.created', data)
    }
  }

  /**
   * Broadcast a ticket updated event.
   */
  async broadcastTicketUpdated(ticket: Ticket): Promise<void> {
    if (!this.isEventEnabled('ticketUpdated')) return

    const data = this.serializeTicket(ticket)
    await this.broadcast(this.ticketChannel(ticket.id), 'ticket.updated', data)
  }

  /**
   * Broadcast a ticket status changed event.
   */
  async broadcastTicketStatusChanged(
    ticket: Ticket,
    oldStatus: TicketStatus,
    newStatus: TicketStatus
  ): Promise<void> {
    if (!this.isEventEnabled('ticketStatusChanged')) return

    const data = {
      ...this.serializeTicket(ticket),
      old_status: oldStatus,
      new_status: newStatus,
    }

    await this.broadcast(this.ticketChannel(ticket.id), 'ticket.status_changed', data)
    await this.broadcast(this.agentDashboardChannel(), 'ticket.status_changed', data)
  }

  /**
   * Broadcast a ticket assigned event.
   */
  async broadcastTicketAssigned(ticket: Ticket, agentId: number): Promise<void> {
    if (!this.isEventEnabled('ticketAssigned')) return

    const data = { ...this.serializeTicket(ticket), assigned_to: agentId }

    await this.broadcast(this.ticketChannel(ticket.id), 'ticket.assigned', data)
    await this.broadcast(this.userChannel(agentId), 'ticket.assigned', data)
  }

  /**
   * Broadcast a reply created event.
   */
  async broadcastReplyCreated(reply: Reply, ticket: Ticket): Promise<void> {
    if (reply.isInternalNote) {
      if (!this.isEventEnabled('internalNoteAdded')) return
    } else {
      if (!this.isEventEnabled('replyCreated')) return
    }

    const data = {
      ticket_id: ticket.id,
      reply_id: reply.id,
      author_type: reply.authorType,
      author_id: reply.authorId,
      is_internal_note: reply.isInternalNote,
      body_preview: reply.body.slice(0, 100),
    }

    await this.broadcast(
      this.ticketChannel(ticket.id),
      reply.isInternalNote ? 'reply.note_added' : 'reply.created',
      data
    )
  }

  // ---- Helpers ----

  /**
   * Serialize a ticket for broadcasting.
   */
  protected serializeTicket(ticket: Ticket): Record<string, any> {
    return {
      id: ticket.id,
      reference: ticket.reference,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      assigned_to: ticket.assignedTo,
      department_id: ticket.departmentId,
    }
  }

  /**
   * Build a broadcast payload.
   */
  buildPayload(channel: string, event: string, data: Record<string, any>): BroadcastPayload {
    return {
      event,
      channel,
      data,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Dispatch a broadcast event to the configured transport.
   */
  protected async broadcast(channel: string, event: string, data: Record<string, any>) {
    if (!this.config.enabled || !this.transport) return
    await this.transport(channel, event, data)
  }
}
