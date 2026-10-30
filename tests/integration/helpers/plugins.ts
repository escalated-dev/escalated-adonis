/** Record SDK plugins (by name) as active, as Admin > Plugins does. */
export async function activateSdkPlugins(...names: string[]) {
  const { DateTime } = await import('luxon')
  const { default: Plugin } = await import('../../../src/models/plugin.js')
  const { sdkPluginSlug } = await import('../../../src/bridge/sdk_plugin_activation.js')
  for (const name of names) {
    await Plugin.updateOrCreate(
      { slug: sdkPluginSlug(name) },
      { isActive: true, activatedAt: DateTime.now() }
    )
  }
}
