/*
|--------------------------------------------------------------------------
| Container bindings augmentation
|--------------------------------------------------------------------------
|
| The provider registers each escalated singleton against a string key
| (e.g. `'escalated.ticketService'`). AdonisJS 6 requires those keys to
| be declared on `ContainerBindings` so `container.make(key)` returns the
| right type and `container.singleton(key, ...)` accepts the resolver.
|
| This file is loaded for its side effects in `index.ts`, the same way
| `augmentations.ts` pulls in the host middleware augmentations.
|
*/

import type HookManager from '../support/hook_manager.js'
import type PluginUIService from '../services/plugin_ui_service.js'
import type PluginService from '../services/plugin_service.js'
import type PluginBridge from '../bridge/plugin_bridge.js'
import type TicketService from '../services/ticket_service.js'
import type AssignmentService from '../services/assignment_service.js'
import type SlaService from '../services/sla_service.js'
import type EscalationService from '../services/escalation_service.js'
import type MacroService from '../services/macro_service.js'
import type NotificationService from '../services/notification_service.js'
import type AttachmentService from '../services/attachment_service.js'
import type InboundEmailService from '../services/inbound_email_service.js'
import type ImportService from '../services/import_service.js'
import type ChatSessionService from '../services/chat_session_service.js'
import type ChatRoutingService from '../services/chat_routing_service.js'
import type ChatAvailabilityService from '../services/chat_availability_service.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'escalated.hookManager': HookManager
    'escalated.pluginUIService': PluginUIService
    'escalated.pluginService': PluginService
    'escalated.pluginBridge': PluginBridge
    'escalated.ticketService': TicketService
    'escalated.assignmentService': AssignmentService
    'escalated.slaService': SlaService
    'escalated.escalationService': EscalationService
    'escalated.macroService': MacroService
    'escalated.notificationService': NotificationService
    'escalated.attachmentService': AttachmentService
    'escalated.inboundEmailService': InboundEmailService
    'escalated.importService': ImportService
    'escalated.chatSessionService': ChatSessionService
    'escalated.chatRoutingService': ChatRoutingService
    'escalated.chatAvailabilityService': ChatAvailabilityService
  }
}
