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

// Plugin system
export { default as HookManager } from './src/support/hook_manager.js'
export { default as HookRegistry } from './src/services/hook_registry.js'
export { default as PluginService } from './src/services/plugin_service.js'
export { default as PluginUIService } from './src/services/plugin_ui_service.js'
export { default as PluginModel } from './src/models/plugin.js'

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
