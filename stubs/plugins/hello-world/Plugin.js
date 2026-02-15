/**
 * Hello World Plugin for Escalated
 *
 * This plugin demonstrates the Escalated plugin system and does nothing
 * particularly useful. It is here to show you how plugins work and give
 * you a starting point for building your own.
 *
 * Demonstrates:
 * - How to use action hooks
 * - How to use filter hooks
 * - How to handle lifecycle events (activate, deactivate, uninstall)
 * - How to register UI components (menu items, dashboard widgets, page slots)
 *
 * Delete this whenever you want!
 */

export default function register(hooks) {
  // ========================================
  // LIFECYCLE HOOKS
  // ========================================

  // Runs when this plugin is activated
  hooks.addAction('plugin_activated_hello-world', async () => {
    console.log('[HelloWorld] Plugin activated! Time to do... nothing!')
  })

  // Runs when this plugin is deactivated
  hooks.addAction('plugin_deactivated_hello-world', async () => {
    console.log('[HelloWorld] Plugin deactivated. We had a good run!')
  })

  // Runs when this plugin is about to be deleted
  hooks.addAction('plugin_uninstalling_hello-world', async () => {
    console.log('[HelloWorld] Plugin is being deleted. Goodbye!')
  })

  // ========================================
  // REGULAR PLUGIN CODE
  // ========================================

  // Log when the plugin is loaded
  hooks.addAction('plugin_loaded', async (slug, manifest) => {
    if (slug === 'hello-world') {
      console.log(`[HelloWorld] Plugin loaded! Version: ${manifest.version ?? 'unknown'}`)

      // Register a component on the dashboard header slot
      const pluginUI = globalThis.__escalated_pluginUI
      if (pluginUI) {
        pluginUI.addPageComponent('dashboard', 'header', {
          component: 'HelloWorldBanner',
          plugin: 'hello-world',
          position: 1,
        })
      }
    }
  })

  // ========================================
  // EXAMPLES (uncomment to try!)
  // ========================================

  // Example 1: Log when tickets are created
  // hooks.addAction('ticket_created', async (ticket) => {
  //   console.log(`[HelloWorld] A ticket was created: ${ticket.subject}`)
  // })

  // Example 2: Modify ticket subjects before display
  // hooks.addFilter('ticket_display_subject', async (subject) => {
  //   return `[Demo] ${subject}`
  // })

  // Example 3: Add custom dashboard stats
  // hooks.addFilter('dashboard_stats_data', async (stats) => {
  //   stats.hello_world_metric = Math.floor(Math.random() * 100)
  //   return stats
  // })

  // Example 4: Register a custom menu item
  // const pluginUI = globalThis.__escalated_pluginUI
  // if (pluginUI) {
  //   pluginUI.addMenuItem({
  //     label: 'Hello World',
  //     route: 'escalated.agent.dashboard',
  //     icon: 'sparkles',
  //     position: 999,
  //   })
  // }
}
