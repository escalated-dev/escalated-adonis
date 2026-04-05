export * as errors from './src/errors.js';
export { configure } from './configure.js';
export * as symbols from './src/symbols.js';
export { AuthManager } from './src/auth_manager.js';
export { defineConfig } from './src/define_config.js';
export { Authenticator } from './src/authenticator.js';
export { AuthenticatorClient } from './src/authenticator_client.js';
import type { withAuthFinder as withAuthFinderType } from './src/mixins/lucid.js';
/**
 * @deprecated Import `withAuthFinder` from `@adonisjs/auth/mixins/lucid` instead
 */
declare let withAuthFinder: typeof withAuthFinderType;
export { withAuthFinder };
