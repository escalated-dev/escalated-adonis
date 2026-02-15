/*
|--------------------------------------------------------------------------
| HookRegistry
|--------------------------------------------------------------------------
|
| Central registry of all available hooks and filters in the Escalated
| package. This class serves as documentation — plugins can reference
| this to discover what hooks are available to extend.
|
*/

export interface HookDefinition {
  description: string
  parameters: string[]
  example: string
}

export default class HookRegistry {
  /**
   * Get all available action hooks.
   */
  static getActions(): Record<string, HookDefinition> {
    return {
      // ========================================
      // PLUGIN LIFECYCLE
      // ========================================
      plugin_loaded: {
        description: 'Fired when a plugin is loaded during boot or activation',
        parameters: ['slug: string', 'manifest: PluginManifest'],
        example: `escalated_addAction('plugin_loaded', async (slug, manifest) => { /* ... */ })`,
      },
      plugin_activated: {
        description: 'Fired when any plugin is activated',
        parameters: ['slug: string'],
        example: `escalated_addAction('plugin_activated', async (slug) => { /* ... */ })`,
      },
      'plugin_activated_{slug}': {
        description: 'Fired when a specific plugin is activated (replace {slug} with your plugin slug)',
        parameters: [],
        example: `escalated_addAction('plugin_activated_my-plugin', async () => { /* ... */ })`,
      },
      plugin_deactivated: {
        description: 'Fired when any plugin is deactivated',
        parameters: ['slug: string'],
        example: `escalated_addAction('plugin_deactivated', async (slug) => { /* ... */ })`,
      },
      'plugin_deactivated_{slug}': {
        description: 'Fired when a specific plugin is deactivated',
        parameters: [],
        example: `escalated_addAction('plugin_deactivated_my-plugin', async () => { /* ... */ })`,
      },
      plugin_uninstalling: {
        description: 'Fired before any plugin is deleted',
        parameters: ['slug: string'],
        example: `escalated_addAction('plugin_uninstalling', async (slug) => { /* ... */ })`,
      },
      'plugin_uninstalling_{slug}': {
        description: 'Fired before a specific plugin is deleted',
        parameters: [],
        example: `escalated_addAction('plugin_uninstalling_my-plugin', async () => { /* ... */ })`,
      },

      // ========================================
      // TICKET HOOKS
      // ========================================
      ticket_created: {
        description: 'Fired after a ticket is created',
        parameters: ['ticket: Ticket'],
        example: `escalated_addAction('ticket_created', async (ticket) => { /* ... */ })`,
      },
      ticket_updated: {
        description: 'Fired after a ticket is updated',
        parameters: ['ticket: Ticket'],
        example: `escalated_addAction('ticket_updated', async (ticket) => { /* ... */ })`,
      },
      ticket_deleted: {
        description: 'Fired after a ticket is deleted',
        parameters: ['ticket: Ticket'],
        example: `escalated_addAction('ticket_deleted', async (ticket) => { /* ... */ })`,
      },
      ticket_status_changed: {
        description: 'Fired when a ticket status changes',
        parameters: ['ticket: Ticket', 'oldStatus: string', 'newStatus: string', 'causer: any'],
        example: `escalated_addAction('ticket_status_changed', async (ticket, old, next, causer) => { /* ... */ })`,
      },
      ticket_assigned: {
        description: 'Fired when a ticket is assigned to an agent',
        parameters: ['ticket: Ticket', 'agentId: number', 'causer: any'],
        example: `escalated_addAction('ticket_assigned', async (ticket, agentId, causer) => { /* ... */ })`,
      },
      ticket_replied: {
        description: 'Fired when a reply is added to a ticket',
        parameters: ['ticket: Ticket', 'reply: Reply'],
        example: `escalated_addAction('ticket_replied', async (ticket, reply) => { /* ... */ })`,
      },
      ticket_resolved: {
        description: 'Fired when a ticket is resolved',
        parameters: ['ticket: Ticket', 'causer: any'],
        example: `escalated_addAction('ticket_resolved', async (ticket, causer) => { /* ... */ })`,
      },
      ticket_closed: {
        description: 'Fired when a ticket is closed',
        parameters: ['ticket: Ticket', 'causer: any'],
        example: `escalated_addAction('ticket_closed', async (ticket, causer) => { /* ... */ })`,
      },
      ticket_reopened: {
        description: 'Fired when a ticket is reopened',
        parameters: ['ticket: Ticket', 'causer: any'],
        example: `escalated_addAction('ticket_reopened', async (ticket, causer) => { /* ... */ })`,
      },
      ticket_escalated: {
        description: 'Fired when a ticket is escalated',
        parameters: ['ticket: Ticket'],
        example: `escalated_addAction('ticket_escalated', async (ticket) => { /* ... */ })`,
      },
      ticket_priority_changed: {
        description: 'Fired when a ticket priority changes',
        parameters: ['ticket: Ticket', 'oldPriority: string', 'newPriority: string', 'causer: any'],
        example: `escalated_addAction('ticket_priority_changed', async (ticket, old, next, causer) => { /* ... */ })`,
      },
      ticket_department_changed: {
        description: 'Fired when a ticket is moved to a different department',
        parameters: ['ticket: Ticket', 'oldDepartmentId: number | null', 'newDepartmentId: number', 'causer: any'],
        example: `escalated_addAction('ticket_department_changed', async (ticket, oldId, newId, causer) => { /* ... */ })`,
      },
      ticket_tag_added: {
        description: 'Fired when a tag is added to a ticket',
        parameters: ['ticket: Ticket', 'tag: Tag'],
        example: `escalated_addAction('ticket_tag_added', async (ticket, tag) => { /* ... */ })`,
      },
      ticket_tag_removed: {
        description: 'Fired when a tag is removed from a ticket',
        parameters: ['ticket: Ticket', 'tag: Tag'],
        example: `escalated_addAction('ticket_tag_removed', async (ticket, tag) => { /* ... */ })`,
      },
      sla_breached: {
        description: 'Fired when a ticket breaches its SLA',
        parameters: ['ticket: Ticket', "type: 'first_response' | 'resolution'"],
        example: `escalated_addAction('sla_breached', async (ticket, type) => { /* ... */ })`,
      },

      // ========================================
      // DASHBOARD HOOKS
      // ========================================
      dashboard_viewed: {
        description: 'Fired when an agent/admin views the dashboard',
        parameters: ['user: any'],
        example: `escalated_addAction('dashboard_viewed', async (user) => { /* ... */ })`,
      },
    }
  }

  /**
   * Get all available filter hooks.
   */
  static getFilters(): Record<string, HookDefinition> {
    return {
      // ========================================
      // TICKET FILTERS
      // ========================================
      ticket_display_subject: {
        description: 'Modify ticket subject before display',
        parameters: ['subject: string', 'ticket: Ticket'],
        example: `escalated_addFilter('ticket_display_subject', async (subject, ticket) => { return subject.toUpperCase() })`,
      },
      ticket_list_query: {
        description: 'Modify the ticket listing database query',
        parameters: ['query: ModelQueryBuilder', 'request: Request'],
        example: `escalated_addFilter('ticket_list_query', async (query, request) => { return query.where('priority', 'high') })`,
      },
      ticket_list_data: {
        description: 'Modify the ticket collection before rendering the list page',
        parameters: ['tickets: Ticket[]', 'request: Request'],
        example: `escalated_addFilter('ticket_list_data', async (tickets, request) => { return tickets })`,
      },
      ticket_show_data: {
        description: 'Modify data passed to the ticket detail page',
        parameters: ['data: Record<string, any>', 'ticket: Ticket'],
        example: `escalated_addFilter('ticket_show_data', async (data, ticket) => { data.custom = 'value'; return data })`,
      },
      ticket_store_data: {
        description: 'Modify validated data before creating a ticket',
        parameters: ['data: Record<string, any>', 'request: Request'],
        example: `escalated_addFilter('ticket_store_data', async (data, request) => { return data })`,
      },
      ticket_update_data: {
        description: 'Modify validated data before updating a ticket',
        parameters: ['data: Record<string, any>', 'ticket: Ticket', 'request: Request'],
        example: `escalated_addFilter('ticket_update_data', async (data, ticket, request) => { return data })`,
      },

      // ========================================
      // DASHBOARD FILTERS
      // ========================================
      dashboard_stats_data: {
        description: 'Modify dashboard statistics data before rendering',
        parameters: ['stats: Record<string, any>', 'user: any'],
        example: `escalated_addFilter('dashboard_stats_data', async (stats, user) => { stats.custom_metric = 42; return stats })`,
      },
      dashboard_page_data: {
        description: 'Modify all data passed to the dashboard page',
        parameters: ['data: Record<string, any>', 'user: any'],
        example: `escalated_addFilter('dashboard_page_data', async (data, user) => { return data })`,
      },

      // ========================================
      // UI FILTERS
      // ========================================
      navigation_menu: {
        description: 'Add or modify navigation menu items',
        parameters: ['menuItems: MenuItem[]', 'user: any'],
        example: `escalated_addFilter('navigation_menu', async (items, user) => { items.push({ label: 'Custom', url: '/custom' }); return items })`,
      },
      sidebar_menu: {
        description: 'Add or modify sidebar menu items',
        parameters: ['menuItems: MenuItem[]', 'user: any'],
        example: `escalated_addFilter('sidebar_menu', async (items, user) => { return items })`,
      },

      // ========================================
      // REPLY FILTERS
      // ========================================
      reply_body: {
        description: 'Modify reply body before storing',
        parameters: ['body: string', 'ticket: Ticket', 'author: any'],
        example: `escalated_addFilter('reply_body', async (body, ticket, author) => { return body })`,
      },

      // ========================================
      // NOTIFICATION FILTERS
      // ========================================
      notification_channels: {
        description: 'Modify notification channels for a ticket event',
        parameters: ['channels: string[]', 'event: string', 'ticket: Ticket'],
        example: `escalated_addFilter('notification_channels', async (channels, event, ticket) => { channels.push('slack'); return channels })`,
      },
    }
  }

  /**
   * Get all hooks (both actions and filters).
   */
  static getAllHooks(): { actions: Record<string, HookDefinition>; filters: Record<string, HookDefinition> } {
    return {
      actions: this.getActions(),
      filters: this.getFilters(),
    }
  }
}
