import type { HttpContext } from '@adonisjs/core/http';
import type { ConfigProvider } from '@adonisjs/core/types';
import { BasicAuthGuard } from './guard.js';
import type { GuardConfigProvider } from '../../src/types.js';
import { BasicAuthLucidUserProvider } from './user_providers/lucid.js';
import type { LucidAuthenticatable, BasicAuthUserProviderContract, BasicAuthLucidUserProviderOptions } from './types.js';
/**
 * Configures basic auth guard for authentication
 */
export declare function basicAuthGuard<UserProvider extends BasicAuthUserProviderContract<unknown>>(config: {
    provider: UserProvider | ConfigProvider<UserProvider>;
}): GuardConfigProvider<(ctx: HttpContext) => BasicAuthGuard<UserProvider>>;
/**
 * Configures user provider that uses Lucid models to authenticate
 * users using basic auth
 */
export declare function basicAuthUserProvider<Model extends LucidAuthenticatable>(config: BasicAuthLucidUserProviderOptions<Model>): BasicAuthLucidUserProvider<Model>;
