/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export all the models, services, types, and events from the package.
|
*/

export { configure } from './configure.js'
export { default as EscalatedProvider } from './providers/escalated_provider.js'

// Re-export types
export * from './src/types.js'

// Re-export events
export * from './src/events/index.js'

// Re-export API model and middleware
export { default as ApiToken } from './src/models/api_token.js'
export { default as AuthenticateApiToken } from './src/middleware/authenticate_api_token.js'
export { default as ApiRateLimit } from './src/middleware/api_rate_limit.js'
// Plugin system
export { default as HookManager } from './src/support/hook_manager.js'
export { default as HookRegistry } from './src/services/hook_registry.js'
export { default as PluginService } from './src/services/plugin_service.js'
export { default as PluginUIService } from './src/services/plugin_ui_service.js'
export { default as PluginModel } from './src/models/plugin.js'

// SDK plugin bridge (in-process)
export { default as PluginBridge } from './src/bridge/plugin_bridge.js'
export { default as Dispatcher } from './src/bridge/dispatcher.js'
export { default as NativeContext } from './src/bridge/native_context.js'
export { default as RouteRegistrar } from './src/bridge/route_registrar.js'
export { default as PluginStoreRecord } from './src/models/plugin_store_record.js'

// Renderer abstraction (UI-optional support)
export {
  getRenderer,
  isUiEnabled,
  resetRenderer,
  InertiaRenderer,
  JsonRenderer,
} from './src/rendering/renderer.js'
export type { RendererContract } from './src/rendering/renderer.js'

// Global helper functions (prefixed with escalated_ to avoid conflicts)
export {
  escalated_addAction,
  escalated_doAction,
  escalated_hasAction,
  escalated_removeAction,
  escalated_addFilter,
  escalated_applyFilters,
  escalated_hasFilter,
  escalated_removeFilter,
  escalated_registerMenuItem,
  escalated_registerDashboardWidget,
  escalated_addPageComponent,
  escalated_getPageComponents,
} from './src/support/helpers.js'
// Re-export i18n support
export { t, setLocale, getLocale } from './src/support/i18n.js'

// Import framework
export { default as ImportJob } from './src/models/import_job.js'
export { default as ImportSourceMap } from './src/models/import_source_map.js'
export { default as ImportService } from './src/services/import_service.js'
export { default as ImportContext } from './src/support/import_context.js'
export { ExtractResult } from './src/contracts/import_adapter.js'
export type { ImportAdapter, CredentialField } from './src/contracts/import_adapter.js'
export type { ImportJobStatus, EntityProgress, ErrorLogEntry } from './src/models/import_job.js'

// Live Chat
export { default as ChatSession } from './src/models/chat_session.js'
export { default as ChatRoutingRule } from './src/models/chat_routing_rule.js'
export { default as AgentProfile } from './src/models/agent_profile.js'
export { default as ChatSessionService } from './src/services/chat_session_service.js'
export { default as ChatRoutingService } from './src/services/chat_routing_service.js'
export { default as ChatAvailabilityService } from './src/services/chat_availability_service.js'
