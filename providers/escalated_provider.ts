import type { ApplicationService } from '@adonisjs/core/types'
import type { EscalatedConfig } from '../src/types.js'
import { setLocale } from '../src/support/i18n.js'

export default class EscalatedProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Lazily-resolved PluginBridge singleton — kept as an instance property so
   * shutdown() can call bridge.shutdown() without going through the container.
   */
  private pluginBridge: import('../src/bridge/plugin_bridge.js').default | null = null

  /**
   * Register bindings to the container
   */
  register() {
    // Register HookManager as a singleton (core of the plugin system)
    this.app.container.singleton('escalated.hookManager', async () => {
      const { default: HookManager } = await import('../src/support/hook_manager.js')
      const instance = new HookManager()
      // Also store on globalThis so controllers and helpers can access it
      ;(globalThis as any).__escalated_hooks = instance
      return instance
    })

    // Register PluginUIService as a singleton
    this.app.container.singleton('escalated.pluginUIService', async () => {
      const { default: PluginUIService } = await import('../src/services/plugin_ui_service.js')
      const instance = new PluginUIService()
      ;(globalThis as any).__escalated_pluginUI = instance
      return instance
    })

    // Register PluginService as a singleton
    this.app.container.singleton('escalated.pluginService', async () => {
      const { default: PluginService } = await import('../src/services/plugin_service.js')
      const hookManager = await this.app.container.make('escalated.hookManager')
      return new PluginService(hookManager)
    })

    // Register PluginBridge (in-process SDK bridge) as a singleton
    this.app.container.singleton('escalated.pluginBridge', async () => {
      const { default: PluginBridge } = await import('../src/bridge/plugin_bridge.js')
      const instance = new PluginBridge()
      this.pluginBridge = instance
      ;(globalThis as any).__escalated_pluginBridge = instance
      return instance
    })

    // Register services as singletons
    this.app.container.singleton('escalated.ticketService', async () => {
      const { default: TicketService } = await import('../src/services/ticket_service.js')
      return new TicketService()
    })

    this.app.container.singleton('escalated.assignmentService', async () => {
      const { default: AssignmentService } = await import('../src/services/assignment_service.js')
      return new AssignmentService()
    })

    this.app.container.singleton('escalated.slaService', async () => {
      const { default: SlaService } = await import('../src/services/sla_service.js')
      return new SlaService()
    })

    this.app.container.singleton('escalated.escalationService', async () => {
      const { default: EscalationService } = await import('../src/services/escalation_service.js')
      return new EscalationService()
    })

    this.app.container.singleton('escalated.macroService', async () => {
      const { default: MacroService } = await import('../src/services/macro_service.js')
      return new MacroService()
    })

    this.app.container.singleton('escalated.notificationService', async () => {
      const { default: NotificationService } = await import('../src/services/notification_service.js')
      return new NotificationService()
    })

    this.app.container.singleton('escalated.attachmentService', async () => {
      const { default: AttachmentService } = await import('../src/services/attachment_service.js')
      return new AttachmentService()
    })

    this.app.container.singleton('escalated.inboundEmailService', async () => {
      const { default: InboundEmailService } = await import('../src/services/inbound_email_service.js')
      return new InboundEmailService()
    })

    this.app.container.singleton('escalated.importService', async () => {
      const { default: ImportService } = await import('../src/services/import_service.js')
      return new ImportService()
    })
  }

  /**
   * Boot the provider
   */
  async boot() {
    // Load config and store globally for services to access
    await this.loadConfig()

    // Initialize the HookManager and PluginUIService singletons eagerly
    await this.app.container.make('escalated.hookManager')
    await this.app.container.make('escalated.pluginUIService')

    // Boot the in-process SDK plugin bridge before registering routes so that
    // plugin routes (endpoints + webhooks) are available at the same time as
    // the core escalated routes.
    await this.bootPluginBridge()

    // Register routes
    await this.registerRoutes()

    // Wire AdonisJS emitter events → plugin bridge action hooks
    await this.wireEventsToBridge()

    // Share Inertia data
    await this.shareInertiaData()

    // Load active plugins (must happen after config is loaded)
    await this.loadPlugins()
  }

  /**
   * Load and store the escalated config.
   */
  protected async loadConfig() {
    try {
      const configService = await this.app.container.make('config')
      const config: EscalatedConfig = configService.get('escalated', {})

      // Store config globally for services that cannot inject the container
      ;(globalThis as any).__escalated_config = config

      // Set locale from config if available
      if (config.locale) {
        setLocale(config.locale)
      }
    } catch {
      // Config may not be available yet during testing
      ;(globalThis as any).__escalated_config = {}
    }
  }

  /**
   * Register routes if enabled.
   * API routes are conditionally loaded within registerRoutes() when
   * the `api.enabled` config flag is true.
   */
  protected async registerRoutes() {
    const config: EscalatedConfig = (globalThis as any).__escalated_config ?? {}

    if (config.routes?.enabled === false) {
      return
    }

    const { registerRoutes } = await import('../start/routes.js')
    registerRoutes()
  }

  /**
   * Share Inertia data (is_agent, is_admin, prefix, etc.)
   */
  protected async shareInertiaData() {
    try {
      const inertia = await this.app.container.make('inertia')

      inertia.share(() => {
        return {
          escalated: async (ctx: any) => {
            const config: EscalatedConfig = (globalThis as any).__escalated_config ?? {}
            const user = ctx?.auth?.user

            const data: Record<string, any> = {
              prefix: config.routes?.prefix ?? 'support',
              is_agent: false,
              is_admin: false,
            }

            if (user) {
              if (config.authorization?.isAgent) {
                data.is_agent = await config.authorization.isAgent(user)
              }
              if (config.authorization?.isAdmin) {
                data.is_admin = await config.authorization.isAdmin(user)
              }
            }

            // Share guest tickets setting
            try {
              const { default: EscalatedSetting } = await import('../src/models/escalated_setting.js')
              data.guest_tickets_enabled = await EscalatedSetting.guestTicketsEnabled()
              data.show_powered_by = await EscalatedSetting.getBool('show_powered_by', true)
            } catch {
              // Settings table may not exist yet
            }

            return data
          },
        }
      })
    } catch {
      // Inertia may not be available
    }
  }

  /**
   * Subscribe to AdonisJS emitter events and forward them to the plugin
   * bridge's dispatchAction() so SDK plugins can react to core lifecycle
   * events without requiring each service to know about the bridge.
   *
   * The mapping follows the same hook naming convention used by the Laravel
   * bridge so plugin code can be host-agnostic.
   */
  protected async wireEventsToBridge() {
    try {
      const { default: emitter } = await import('@adonisjs/core/services/emitter')
      const { ESCALATED_EVENTS } = await import('../src/events/index.js')

      const bridge = (globalThis as any).__escalated_pluginBridge
      if (!bridge) return

      const dispatch = (hook: string, data: unknown) => {
        bridge.dispatchAction(hook, data).catch((err: Error) => {
          console.warn(`[Escalated Bridge] dispatchAction("${hook}") failed:`, err.message)
        })
      }

      emitter.on(ESCALATED_EVENTS.TICKET_CREATED, (data) =>
        dispatch('ticket_created', { ticket: data.ticket?.toJSON?.() ?? data.ticket })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_UPDATED, (data) =>
        dispatch('ticket_updated', { ticket: data.ticket?.toJSON?.() ?? data.ticket })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_STATUS_CHANGED, (data) =>
        dispatch('ticket_status_changed', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          old_status: data.oldStatus,
          new_status: data.newStatus,
        })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_RESOLVED, (data) =>
        dispatch('ticket_resolved', { ticket: data.ticket?.toJSON?.() ?? data.ticket })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_CLOSED, (data) =>
        dispatch('ticket_closed', { ticket: data.ticket?.toJSON?.() ?? data.ticket })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_REOPENED, (data) =>
        dispatch('ticket_reopened', { ticket: data.ticket?.toJSON?.() ?? data.ticket })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_ASSIGNED, (data) =>
        dispatch('ticket_assigned', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          agent_id: data.agentId,
        })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_UNASSIGNED, (data) =>
        dispatch('ticket_unassigned', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          previous_agent_id: data.previousAgentId,
        })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_ESCALATED, (data) =>
        dispatch('ticket_escalated', { ticket: data.ticket?.toJSON?.() ?? data.ticket })
      )
      emitter.on(ESCALATED_EVENTS.TICKET_PRIORITY_CHANGED, (data) =>
        dispatch('ticket_priority_changed', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          old_priority: data.oldPriority,
          new_priority: data.newPriority,
        })
      )
      emitter.on(ESCALATED_EVENTS.DEPARTMENT_CHANGED, (data) =>
        dispatch('department_changed', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          old_department_id: data.oldDepartmentId,
          new_department_id: data.newDepartmentId,
        })
      )
      emitter.on(ESCALATED_EVENTS.REPLY_CREATED, (data) =>
        dispatch('reply_created', { reply: data.reply?.toJSON?.() ?? data.reply })
      )
      emitter.on(ESCALATED_EVENTS.INTERNAL_NOTE_ADDED, (data) =>
        dispatch('internal_note_added', { reply: data.reply?.toJSON?.() ?? data.reply })
      )
      emitter.on(ESCALATED_EVENTS.SLA_BREACHED, (data) =>
        dispatch('sla_breached', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          type: data.type,
        })
      )
      emitter.on(ESCALATED_EVENTS.SLA_WARNING, (data) =>
        dispatch('sla_warning', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          type: data.type,
          minutes_remaining: data.minutesRemaining,
        })
      )
      emitter.on(ESCALATED_EVENTS.TAG_ADDED, (data) =>
        dispatch('tag_added', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          tag: data.tag?.toJSON?.() ?? data.tag,
        })
      )
      emitter.on(ESCALATED_EVENTS.TAG_REMOVED, (data) =>
        dispatch('tag_removed', {
          ticket: data.ticket?.toJSON?.() ?? data.ticket,
          tag: data.tag?.toJSON?.() ?? data.tag,
        })
      )
    } catch {
      // Emitter or events not available (testing environment, etc.)
    }
  }

  /**
   * Boot the in-process SDK plugin bridge.
   *
   * Discovers installed @escalated-dev/plugin-* packages, imports them
   * in-process, and registers their routes. No-op if plugins are disabled
   * in config or if no SDK plugins are installed.
   */
  protected async bootPluginBridge() {
    const config: EscalatedConfig = (globalThis as any).__escalated_config ?? {}

    if ((config as any).plugins?.enabled === false) {
      return
    }

    try {
      const bridge = await this.app.container.make('escalated.pluginBridge')
      await bridge.boot()
    } catch (error) {
      // Don't crash the app if the bridge fails to boot
      console.warn(
        '[Escalated Bridge] Could not boot plugin bridge:',
        (error as Error).message
      )
    }
  }

  /**
   * Load active plugins if the plugin system is enabled.
   */
  protected async loadPlugins() {
    const config: EscalatedConfig = (globalThis as any).__escalated_config ?? {}

    if ((config as any).plugins?.enabled === false) {
      return
    }

    try {
      const pluginService = await this.app.container.make('escalated.pluginService')
      await pluginService.loadActivePlugins()
    } catch (error) {
      // Don't crash the app if plugins fail to load (e.g. table doesn't exist yet)
      console.warn('[Escalated] Could not load plugins:', (error as Error).message)
    }
  }

  /**
   * Shutdown hook
   */
  async shutdown() {
    // Shut down the in-process SDK plugin bridge (calls onDeactivate on each plugin)
    if (this.pluginBridge) {
      await this.pluginBridge.shutdown()
    }

    // Clean up HookManager
    const hookManager = (globalThis as any).__escalated_hooks
    if (hookManager && typeof hookManager.clear === 'function') {
      hookManager.clear()
    }

    // Clean up PluginUIService
    const pluginUI = (globalThis as any).__escalated_pluginUI
    if (pluginUI && typeof pluginUI.clear === 'function') {
      pluginUI.clear()
    }

    delete (globalThis as any).__escalated_config
    delete (globalThis as any).__escalated_presence
    delete (globalThis as any).__escalated_hooks
    delete (globalThis as any).__escalated_pluginUI
    delete (globalThis as any).__escalated_pluginBridge
  }
}
