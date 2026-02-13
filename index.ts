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

// Re-export i18n support
export { t, setLocale, getLocale } from './src/support/i18n.js'
