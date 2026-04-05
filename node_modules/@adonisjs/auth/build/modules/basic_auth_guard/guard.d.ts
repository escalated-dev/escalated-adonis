import type { HttpContext } from '@adonisjs/core/http';
import type { EmitterLike } from '@adonisjs/core/types/events';
import type { AuthClientResponse, GuardContract } from '../../src/types.js';
import { GUARD_KNOWN_EVENTS, type PROVIDER_REAL_USER } from '../../src/symbols.js';
import type { BasicAuthGuardEvents, BasicAuthUserProviderContract } from './types.js';
/**
 * BasicAuth guard implements the HTTP Authentication protocol
 */
export declare class BasicAuthGuard<UserProvider extends BasicAuthUserProviderContract<unknown>> implements GuardContract<UserProvider[typeof PROVIDER_REAL_USER]> {
    #private;
    /**
     * Events emitted by the guard
     */
    [GUARD_KNOWN_EVENTS]: BasicAuthGuardEvents<UserProvider[typeof PROVIDER_REAL_USER]>;
    /**
     * Driver name of the guard
     */
    driverName: 'basic_auth';
    /**
     * Whether or not the authentication has been attempted
     * during the current request.
     */
    authenticationAttempted: boolean;
    /**
     * A boolean to know if the current request has
     * been authenticated
     */
    isAuthenticated: boolean;
    /**
     * Reference to an instance of the authenticated user.
     * The value only exists after calling one of the
     * following methods.
     *
     * - authenticate
     * - check
     *
     * You can use the "getUserOrFail" method to throw an exception if
     * the request is not authenticated.
     */
    user?: UserProvider[typeof PROVIDER_REAL_USER];
    constructor(name: string, ctx: HttpContext, emitter: EmitterLike<BasicAuthGuardEvents<UserProvider[typeof PROVIDER_REAL_USER]>>, userProvider: UserProvider);
    /**
     * Returns an instance of the authenticated user. Or throws
     * an exception if the request is not authenticated.
     */
    getUserOrFail(): UserProvider[typeof PROVIDER_REAL_USER];
    /**
     * Authenticates the incoming HTTP request by looking for BasicAuth
     * credentials inside the request authorization header.
     *
     * Returns the authenticated user or throws an exception.
     */
    authenticate(): Promise<UserProvider[typeof PROVIDER_REAL_USER]>;
    /**
     * Silently attempt to authenticate the user.
     *
     * The method returns a boolean indicating if the authentication
     * succeeded or failed.
     */
    check(): Promise<boolean>;
    /**
     * Does not support authenticating as client. Instead use "basicAuth"
     * helper on Japa APIClient
     */
    authenticateAsClient(uid: string, password: string): Promise<AuthClientResponse>;
}
