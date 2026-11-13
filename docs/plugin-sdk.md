# Plugin SDK

## Plugin SDK

Escalated supports framework-agnostic plugins built with the [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk). Plugins are written once in TypeScript and work across all Escalated backends.

### Installing Plugins

```bash
npm install @escalated-dev/plugin-slack
npm install @escalated-dev/plugin-jira
```

### Enabling SDK Plugins

Enable the plugin system in your `EscalatedProvider` config:

```typescript
// config/escalated.ts
const escalatedConfig: EscalatedConfig = {
  // ...
  plugins: {
    enabled: true,
    sdkEnabled: true,
  },
}
```

### How It Works

Unlike other Escalated backends, AdonisJS runs SDK plugins **in-process** — no subprocess, no JSON-RPC overhead. Plugins are loaded directly into the Node.js runtime alongside your AdonisJS application, giving native performance and eliminating the need for a separate plugin runtime process.

### Building Your Own Plugin

```typescript
import { definePlugin } from '@escalated-dev/plugin-sdk'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  actions: {
    'ticket.created': async (event, ctx) => {
      ctx.log.info('New ticket!', event)
    },
  },
})
```

### Resources

- [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) — TypeScript SDK for building plugins
- [Plugin Runtime](https://github.com/escalated-dev/escalated-plugin-runtime) — Runtime host for plugins
- [Plugin Development Guide](https://github.com/escalated-dev/escalated-docs) — Full documentation
