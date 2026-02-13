import type { ApplicationService } from '@adonisjs/core/types'
import type { EscalatedConfig } from '../src/types.js'
import { setLocale } from '../src/support/i18n.js'

export default class EscalatedProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {
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
  }

  /**
   * Boot the provider
   */
  async boot() {
    // Load config and store globally for services to access
    await this.loadConfig()

    // Register routes
    await this.registerRoutes()

    // Share Inertia data
    await this.shareInertiaData()
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
   * Shutdown hook
   */
  async shutdown() {
    delete (globalThis as any).__escalated_config
    delete (globalThis as any).__escalated_presence
  }
}
