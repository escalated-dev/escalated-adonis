import type { HttpContext } from '@adonisjs/core/http';
import type { NextFn } from '@adonisjs/core/types/http';
import type { Authenticator } from '../authenticator.js';
import type { Authenticators, GuardFactory } from '../types.js';
/**
 * The "InitializeAuthMiddleware" is used to create a request
 * specific authenticator instance for every HTTP request.
 *
 * This middleware does not protect routes from unauthenticated
 * users. Please use the "auth" middleware for that.
 */
export default class InitializeAuthMiddleware {
    handle(ctx: HttpContext, next: NextFn): Promise<any>;
}
declare module '@adonisjs/core/http' {
    interface HttpContext {
        auth: Authenticator<Authenticators extends Record<string, GuardFactory> ? Authenticators : never>;
    }
}
