/*
|--------------------------------------------------------------------------
| Escalated Routes
|--------------------------------------------------------------------------
|
| All routes for the Escalated support ticket system.
| These are registered by the EscalatedProvider during boot.
|
*/

import router from '@adonisjs/core/services/router'
import { getConfig } from '../src/helpers/config.js'

// Lazy-load controllers
const CustomerTicketsController = () => import('../src/controllers/customer_tickets_controller.js')
const AgentDashboardController = () => import('../src/controllers/agent_dashboard_controller.js')
const AgentTicketsController = () => import('../src/controllers/agent_tickets_controller.js')
const AdminTicketsController = () => import('../src/controllers/admin_tickets_controller.js')
const AdminDepartmentsController = () => import('../src/controllers/admin_departments_controller.js')
const AdminTagsController = () => import('../src/controllers/admin_tags_controller.js')
const AdminSlaPoliciesController = () => import('../src/controllers/admin_sla_policies_controller.js')
const AdminEscalationRulesController = () => import('../src/controllers/admin_escalation_rules_controller.js')
const AdminCannedResponsesController = () => import('../src/controllers/admin_canned_responses_controller.js')
const AdminMacrosController = () => import('../src/controllers/admin_macros_controller.js')
const AdminReportsController = () => import('../src/controllers/admin_reports_controller.js')
const AdminSettingsController = () => import('../src/controllers/admin_settings_controller.js')
const BulkActionsController = () => import('../src/controllers/bulk_actions_controller.js')
const SatisfactionRatingController = () => import('../src/controllers/satisfaction_rating_controller.js')
const GuestTicketsController = () => import('../src/controllers/guest_tickets_controller.js')
const InboundEmailController = () => import('../src/controllers/inbound_email_controller.js')
const AdminApiTokensController = () => import('../src/controllers/admin_api_tokens_controller.js')

// API controllers
const ApiAuthController = () => import('../src/controllers/api/api_auth_controller.js')
const ApiDashboardController = () => import('../src/controllers/api/api_dashboard_controller.js')
const ApiTicketController = () => import('../src/controllers/api/api_ticket_controller.js')
const ApiResourceController = () => import('../src/controllers/api/api_resource_controller.js')

// Middleware imports
const EnsureIsAgent = () => import('../src/middleware/ensure_is_agent.js')
const EnsureIsAdmin = () => import('../src/middleware/ensure_is_admin.js')
const ResolveTicket = () => import('../src/middleware/resolve_ticket.js')
const AuthenticateApiToken = () => import('../src/middleware/authenticate_api_token.js')
const ApiRateLimit = () => import('../src/middleware/api_rate_limit.js')

export function registerRoutes() {
  const config = getConfig()
  const prefix = config.routes?.prefix ?? 'support'
  const authMiddleware = config.routes?.middleware ?? ['auth']
  const adminMiddleware = config.routes?.adminMiddleware ?? ['auth']

  // ---- Customer Routes ----
  router
    .group(() => {
      router.get('/', [CustomerTicketsController, 'index']).as('escalated.customer.tickets.index')
      router.get('/create', [CustomerTicketsController, 'create']).as('escalated.customer.tickets.create')
      router.post('/', [CustomerTicketsController, 'store']).as('escalated.customer.tickets.store')

      // Ticket-specific routes (with ticket resolution)
      router
        .group(() => {
          router.get('/:ticket', [CustomerTicketsController, 'show']).as('escalated.customer.tickets.show')
          router.post('/:ticket/reply', [CustomerTicketsController, 'reply']).as('escalated.customer.tickets.reply')
          router.post('/:ticket/close', [CustomerTicketsController, 'close']).as('escalated.customer.tickets.close')
          router.post('/:ticket/reopen', [CustomerTicketsController, 'reopen']).as('escalated.customer.tickets.reopen')
          router.post('/:ticket/rate', [SatisfactionRatingController, 'store']).as('escalated.customer.tickets.rate')
        })
        .use([ResolveTicket])
    })
    .prefix(prefix)
    .use(authMiddleware)

  // ---- Agent Routes ----
  router
    .group(() => {
      router.get('/', [AgentDashboardController, 'handle']).as('escalated.agent.dashboard')
      router.get('/tickets', [AgentTicketsController, 'index']).as('escalated.agent.tickets.index')
      router.post('/tickets/bulk', [BulkActionsController, 'handle']).as('escalated.agent.tickets.bulk')

      router
        .group(() => {
          router.get('/tickets/:ticket', [AgentTicketsController, 'show']).as('escalated.agent.tickets.show')
          router.put('/tickets/:ticket', [AgentTicketsController, 'update']).as('escalated.agent.tickets.update')
          router.post('/tickets/:ticket/reply', [AgentTicketsController, 'reply']).as('escalated.agent.tickets.reply')
          router.post('/tickets/:ticket/note', [AgentTicketsController, 'note']).as('escalated.agent.tickets.note')
          router.post('/tickets/:ticket/assign', [AgentTicketsController, 'assign']).as('escalated.agent.tickets.assign')
          router.post('/tickets/:ticket/status', [AgentTicketsController, 'status']).as('escalated.agent.tickets.status')
          router.post('/tickets/:ticket/priority', [AgentTicketsController, 'priority']).as('escalated.agent.tickets.priority')
          router.post('/tickets/:ticket/tags', [AgentTicketsController, 'tags']).as('escalated.agent.tickets.tags')
          router.post('/tickets/:ticket/department', [AgentTicketsController, 'department']).as('escalated.agent.tickets.department')
          router.post('/tickets/:ticket/macro', [AgentTicketsController, 'applyMacro']).as('escalated.agent.tickets.macro')
          router.post('/tickets/:ticket/follow', [AgentTicketsController, 'follow']).as('escalated.agent.tickets.follow')
          router.post('/tickets/:ticket/presence', [AgentTicketsController, 'presence']).as('escalated.agent.tickets.presence')
          router.post('/tickets/:ticket/replies/:reply/pin', [AgentTicketsController, 'pin']).as('escalated.agent.tickets.pin')
        })
        .use([ResolveTicket])
    })
    .prefix(`${prefix}/agent`)
    .use([...adminMiddleware, EnsureIsAgent])

  // ---- Admin Routes ----
  router
    .group(() => {
      // Reports
      router.get('/reports', [AdminReportsController, 'handle']).as('escalated.admin.reports')

      // Tickets
      router.get('/tickets', [AdminTicketsController, 'index']).as('escalated.admin.tickets.index')
      router.post('/tickets/bulk', [BulkActionsController, 'handle']).as('escalated.admin.tickets.bulk')

      router
        .group(() => {
          router.get('/tickets/:ticket', [AdminTicketsController, 'show']).as('escalated.admin.tickets.show')
          router.post('/tickets/:ticket/reply', [AdminTicketsController, 'reply']).as('escalated.admin.tickets.reply')
          router.post('/tickets/:ticket/note', [AdminTicketsController, 'note']).as('escalated.admin.tickets.note')
          router.post('/tickets/:ticket/assign', [AdminTicketsController, 'assign']).as('escalated.admin.tickets.assign')
          router.post('/tickets/:ticket/status', [AdminTicketsController, 'status']).as('escalated.admin.tickets.status')
          router.post('/tickets/:ticket/priority', [AdminTicketsController, 'priority']).as('escalated.admin.tickets.priority')
          router.post('/tickets/:ticket/tags', [AdminTicketsController, 'tags']).as('escalated.admin.tickets.tags')
          router.post('/tickets/:ticket/department', [AdminTicketsController, 'department']).as('escalated.admin.tickets.department')
          router.post('/tickets/:ticket/macro', [AdminTicketsController, 'applyMacro']).as('escalated.admin.tickets.macro')
          router.post('/tickets/:ticket/follow', [AdminTicketsController, 'follow']).as('escalated.admin.tickets.follow')
          router.post('/tickets/:ticket/presence', [AdminTicketsController, 'presence']).as('escalated.admin.tickets.presence')
          router.post('/tickets/:ticket/replies/:reply/pin', [AdminTicketsController, 'pin']).as('escalated.admin.tickets.pin')
        })
        .use([ResolveTicket])

      // Settings
      router.get('/settings', [AdminSettingsController, 'index']).as('escalated.admin.settings')
      router.post('/settings', [AdminSettingsController, 'update']).as('escalated.admin.settings.update')

      // Departments CRUD
      router.get('/departments', [AdminDepartmentsController, 'index']).as('escalated.admin.departments.index')
      router.get('/departments/create', [AdminDepartmentsController, 'create']).as('escalated.admin.departments.create')
      router.post('/departments', [AdminDepartmentsController, 'store']).as('escalated.admin.departments.store')
      router.get('/departments/:id/edit', [AdminDepartmentsController, 'edit']).as('escalated.admin.departments.edit')
      router.put('/departments/:id', [AdminDepartmentsController, 'update']).as('escalated.admin.departments.update')
      router.delete('/departments/:id', [AdminDepartmentsController, 'destroy']).as('escalated.admin.departments.destroy')

      // SLA Policies CRUD
      router.get('/sla-policies', [AdminSlaPoliciesController, 'index']).as('escalated.admin.sla-policies.index')
      router.get('/sla-policies/create', [AdminSlaPoliciesController, 'create']).as('escalated.admin.sla-policies.create')
      router.post('/sla-policies', [AdminSlaPoliciesController, 'store']).as('escalated.admin.sla-policies.store')
      router.get('/sla-policies/:id/edit', [AdminSlaPoliciesController, 'edit']).as('escalated.admin.sla-policies.edit')
      router.put('/sla-policies/:id', [AdminSlaPoliciesController, 'update']).as('escalated.admin.sla-policies.update')
      router.delete('/sla-policies/:id', [AdminSlaPoliciesController, 'destroy']).as('escalated.admin.sla-policies.destroy')

      // Escalation Rules CRUD
      router.get('/escalation-rules', [AdminEscalationRulesController, 'index']).as('escalated.admin.escalation-rules.index')
      router.get('/escalation-rules/create', [AdminEscalationRulesController, 'create']).as('escalated.admin.escalation-rules.create')
      router.post('/escalation-rules', [AdminEscalationRulesController, 'store']).as('escalated.admin.escalation-rules.store')
      router.get('/escalation-rules/:id/edit', [AdminEscalationRulesController, 'edit']).as('escalated.admin.escalation-rules.edit')
      router.put('/escalation-rules/:id', [AdminEscalationRulesController, 'update']).as('escalated.admin.escalation-rules.update')
      router.delete('/escalation-rules/:id', [AdminEscalationRulesController, 'destroy']).as('escalated.admin.escalation-rules.destroy')

      // Tags
      router.get('/tags', [AdminTagsController, 'index']).as('escalated.admin.tags.index')
      router.post('/tags', [AdminTagsController, 'store']).as('escalated.admin.tags.store')
      router.put('/tags/:tag', [AdminTagsController, 'update']).as('escalated.admin.tags.update')
      router.delete('/tags/:tag', [AdminTagsController, 'destroy']).as('escalated.admin.tags.destroy')

      // Canned Responses
      router.get('/canned-responses', [AdminCannedResponsesController, 'index']).as('escalated.admin.canned-responses.index')
      router.post('/canned-responses', [AdminCannedResponsesController, 'store']).as('escalated.admin.canned-responses.store')
      router.put('/canned-responses/:cannedResponse', [AdminCannedResponsesController, 'update']).as('escalated.admin.canned-responses.update')
      router.delete('/canned-responses/:cannedResponse', [AdminCannedResponsesController, 'destroy']).as('escalated.admin.canned-responses.destroy')

      // Macros
      router.get('/macros', [AdminMacrosController, 'index']).as('escalated.admin.macros.index')
      router.post('/macros', [AdminMacrosController, 'store']).as('escalated.admin.macros.store')
      router.put('/macros/:macro', [AdminMacrosController, 'update']).as('escalated.admin.macros.update')
      router.delete('/macros/:macro', [AdminMacrosController, 'destroy']).as('escalated.admin.macros.destroy')

      // API Tokens CRUD
      router.get('/api-tokens', [AdminApiTokensController, 'index']).as('escalated.admin.api-tokens.index')
      router.post('/api-tokens', [AdminApiTokensController, 'store']).as('escalated.admin.api-tokens.store')
      router.put('/api-tokens/:id', [AdminApiTokensController, 'update']).as('escalated.admin.api-tokens.update')
      router.delete('/api-tokens/:id', [AdminApiTokensController, 'destroy']).as('escalated.admin.api-tokens.destroy')
    })
    .prefix(`${prefix}/admin`)
    .use([...adminMiddleware, EnsureIsAdmin])

  // ---- Guest Routes (no auth) ----
  router
    .group(() => {
      router.get('/create', [GuestTicketsController, 'create']).as('escalated.guest.tickets.create')
      router.post('/', [GuestTicketsController, 'store']).as('escalated.guest.tickets.store')
      router.get('/:token', [GuestTicketsController, 'show']).as('escalated.guest.tickets.show')
        .where('token', /^[A-Za-z0-9]{64}$/)
      router.post('/:token/reply', [GuestTicketsController, 'reply']).as('escalated.guest.tickets.reply')
        .where('token', /^[A-Za-z0-9]{64}$/)
      router.post('/:token/rate', [SatisfactionRatingController, 'storeGuest']).as('escalated.guest.tickets.rate')
        .where('token', /^[A-Za-z0-9]{64}$/)
    })
    .prefix(`${prefix}/guest`)

  // ---- Inbound Email Webhook Routes (no auth) ----
  if (config.inboundEmail?.enabled) {
    router
      .group(() => {
        router.post('/:adapter', [InboundEmailController, 'webhook']).as('escalated.inbound.webhook')
          .where('adapter', /^(mailgun|postmark|ses)$/)
      })
      .prefix(`${prefix}/inbound`)
  }

  // ---- API Routes ----
  if ((config as any).api?.enabled) {
    registerApiRoutes(config)
  }
}

/**
 * Register REST API routes for the Escalated support ticket system.
 * These routes use Bearer token authentication and rate limiting.
 */
export function registerApiRoutes(config: any) {
  const apiPrefix = config.api?.prefix ?? 'support/api/v1'

  router
    .group(() => {
      // Auth
      router.post('/auth/validate', [ApiAuthController, 'validate']).as('escalated.api.auth.validate')

      // Dashboard
      router.get('/dashboard', [ApiDashboardController, 'handle']).as('escalated.api.dashboard')

      // Tickets — collection
      router.get('/tickets', [ApiTicketController, 'index']).as('escalated.api.tickets.index')
      router.post('/tickets', [ApiTicketController, 'store']).as('escalated.api.tickets.store')

      // Tickets — single (with ticket resolution by reference)
      router
        .group(() => {
          router.get('/tickets/:ticket', [ApiTicketController, 'show']).as('escalated.api.tickets.show')
          router.post('/tickets/:ticket/reply', [ApiTicketController, 'reply']).as('escalated.api.tickets.reply')
          router.patch('/tickets/:ticket/status', [ApiTicketController, 'status']).as('escalated.api.tickets.status')
          router.patch('/tickets/:ticket/priority', [ApiTicketController, 'priority']).as('escalated.api.tickets.priority')
          router.post('/tickets/:ticket/assign', [ApiTicketController, 'assign']).as('escalated.api.tickets.assign')
          router.post('/tickets/:ticket/follow', [ApiTicketController, 'follow']).as('escalated.api.tickets.follow')
          router.post('/tickets/:ticket/macro', [ApiTicketController, 'applyMacro']).as('escalated.api.tickets.macro')
          router.post('/tickets/:ticket/tags', [ApiTicketController, 'tags']).as('escalated.api.tickets.tags')
          router.delete('/tickets/:ticket', [ApiTicketController, 'destroy']).as('escalated.api.tickets.destroy')
        })
        .use([ResolveTicket])

      // Resources
      router.get('/agents', [ApiResourceController, 'agents']).as('escalated.api.agents')
      router.get('/departments', [ApiResourceController, 'departments']).as('escalated.api.departments')
      router.get('/tags', [ApiResourceController, 'tags']).as('escalated.api.tags')
      router.get('/canned-responses', [ApiResourceController, 'cannedResponses']).as('escalated.api.canned-responses')
      router.get('/macros', [ApiResourceController, 'macros']).as('escalated.api.macros')

      // Realtime
      router.get('/realtime/config', [ApiResourceController, 'realtimeConfig']).as('escalated.api.realtime')
    })
    .prefix(apiPrefix)
    .use([AuthenticateApiToken, ApiRateLimit])
}
