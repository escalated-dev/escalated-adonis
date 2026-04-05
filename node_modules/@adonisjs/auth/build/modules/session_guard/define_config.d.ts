import type { HttpContext } from '@adonisjs/core/http';
import type { ConfigProvider } from '@adonisjs/core/types';
import { SessionGuard } from './guard.js';
import type { GuardConfigProvider } from '../../src/types.js';
import { SessionLucidUserProvider } from './user_providers/lucid.js';
import type { SessionGuardOptions, LucidAuthenticatable, SessionUserProviderContract, SessionLucidUserProviderOptions, SessionWithTokensUserProviderContract } from './types.js';
/**
 * Configures session tokens guard for authentication
 */
export declare function sessionGuard<UseRememberTokens extends boolean, UserProvider extends UseRememberTokens extends true ? SessionWithTokensUserProviderContract<unknown> : SessionUserProviderContract<unknown>>(config: {
    provider: UserProvider | ConfigProvider<UserProvider>;
} & SessionGuardOptions<UseRememberTokens>): GuardConfigProvider<(ctx: HttpContext) => SessionGuard<UseRememberTokens, UserProvider>>;
/**
 * Configures user provider that uses Lucid models to authenticate
 * users using sessions
 */
export declare function sessionUserProvider<Model extends LucidAuthenticatable>(config: SessionLucidUserProviderOptions<Model>): SessionLucidUserProvider<Model>;
