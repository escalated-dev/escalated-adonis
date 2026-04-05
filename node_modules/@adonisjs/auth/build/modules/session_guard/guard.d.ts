import type { HttpContext } from '@adonisjs/core/http';
import type { EmitterLike } from '@adonisjs/core/types/events';
import type { AuthClientResponse, GuardContract } from '../../src/types.js';
import { GUARD_KNOWN_EVENTS, type PROVIDER_REAL_USER } from '../../src/symbols.js';
import type { SessionGuardEvents, SessionGuardOptions, SessionUserProviderContract, SessionWithTokensUserProviderContract } from './types.js';
/**
 * Session guard uses AdonisJS session store to track logged-in
 * user information.
 */
export declare class SessionGuard<UseRememberTokens extends boolean, UserProvider extends UseRememberTokens extends true ? SessionWithTokensUserProviderContract<unknown> : SessionUserProviderContract<unknown>> implements GuardContract<UserProvider[typeof PROVIDER_REAL_USER]> {
    #private;
    /**
     * Events emitted by the guard
     */
    [GUARD_KNOWN_EVENTS]: SessionGuardEvents<UserProvider[typeof PROVIDER_REAL_USER]>;
    /**
     * Driver name of the guard
     */
    driverName: 'session';
    /**
     * Whether or not the authentication has been attempted
     * during the current request.
     */
    authenticationAttempted: boolean;
    /**
     * A boolean to know if a remember me token was used in attempt
     * to login a user.
     */
    attemptedViaRemember: boolean;
    /**
     * A boolean to know if the current request has
     * been authenticated
     */
    isAuthenticated: boolean;
    /**
     * A boolean to know if the current request is authenticated
     * using the "rememember_me" token.
     */
    viaRemember: boolean;
    /**
     * Find if the user has been logged out during
     * the current request
     */
    isLoggedOut: boolean;
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
    /**
     * The key used to store the logged-in user id inside
     * session
     */
    get sessionKeyName(): string;
    /**
     * The key used to store the remember me token cookie
     */
    get rememberMeKeyName(): string;
    constructor(name: string, ctx: HttpContext, options: SessionGuardOptions<UseRememberTokens>, emitter: EmitterLike<SessionGuardEvents<UserProvider[typeof PROVIDER_REAL_USER]>>, userProvider: UserProvider);
    /**
     * Returns an instance of the authenticated user. Or throws
     * an exception if the request is not authenticated.
     */
    getUserOrFail(): UserProvider[typeof PROVIDER_REAL_USER];
    /**
     * Login user using sessions. Optionally, you can also create
     * a remember me token to automatically login user when their
     * session expires.
     */
    login(user: UserProvider[typeof PROVIDER_REAL_USER], remember?: boolean): Promise<void>;
    /**
     * Logout a user by removing its state from the session
     * store and delete the remember me cookie (if any).
     */
    logout(): Promise<void>;
    /**
     * Authenticate the current HTTP request by verifying the bearer
     * token or fails with an exception
     */
    authenticate(): Promise<UserProvider[typeof PROVIDER_REAL_USER]>;
    /**
     * Silently check if the user is authenticated or not, without
     * throwing any exceptions
     */
    check(): Promise<boolean>;
    /**
     * Returns the session info for the clients to send during
     * an HTTP request to mark the user as logged-in.
     */
    authenticateAsClient(user: UserProvider[typeof PROVIDER_REAL_USER]): Promise<AuthClientResponse>;
}
