import type { HttpContext } from '@adonisjs/core/http';
import type { ConfigProvider } from '@adonisjs/core/types';
import { AccessTokensGuard } from './guard.js';
import type { GuardConfigProvider } from '../../src/types.js';
import { AccessTokensLucidUserProvider } from './user_providers/lucid.js';
import type { LucidTokenable, AccessTokensUserProviderContract, AccessTokensLucidUserProviderOptions } from './types.js';
/**
 * Configures access tokens guard for authentication
 */
export declare function tokensGuard<UserProvider extends AccessTokensUserProviderContract<unknown>>(config: {
    provider: UserProvider | ConfigProvider<UserProvider>;
}): GuardConfigProvider<(ctx: HttpContext) => AccessTokensGuard<UserProvider>>;
/**
 * Configures user provider that uses Lucid models to verify
 * access tokens and find users during authentication.
 */
export declare function tokensUserProvider<TokenableProperty extends string, Model extends LucidTokenable<TokenableProperty>>(config: AccessTokensLucidUserProviderOptions<TokenableProperty, Model>): AccessTokensLucidUserProvider<TokenableProperty, Model>;
