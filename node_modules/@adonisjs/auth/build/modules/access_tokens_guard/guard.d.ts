import type { HttpContext } from '@adonisjs/core/http';
import type { EmitterLike } from '@adonisjs/core/types/events';
import type { AccessToken } from './access_token.js';
import type { AuthClientResponse, GuardContract } from '../../src/types.js';
import { GUARD_KNOWN_EVENTS, type PROVIDER_REAL_USER } from '../../src/symbols.js';
import type { AccessTokensGuardEvents, AccessTokensUserProviderContract } from './types.js';
/**
 * Implementation of access tokens guard for the Auth layer. The heavy lifting
 * of verifying tokens is done by the user provider. However, the guard is
 * used to seamlessly integrate with the auth layer of the package.
 */
export declare class AccessTokensGuard<UserProvider extends AccessTokensUserProviderContract<unknown>> implements GuardContract<UserProvider[typeof PROVIDER_REAL_USER] & {
    currentAccessToken: AccessToken;
}> {
    #private;
    /**
     * Events emitted by the guard
     */
    [GUARD_KNOWN_EVENTS]: AccessTokensGuardEvents<UserProvider[typeof PROVIDER_REAL_USER] & {
        currentAccessToken: AccessToken;
    }>;
    /**
     * Driver name of the guard
     */
    driverName: 'access_tokens';
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
    user?: UserProvider[typeof PROVIDER_REAL_USER] & {
        currentAccessToken: AccessToken;
    };
    constructor(name: string, ctx: HttpContext, emitter: EmitterLike<AccessTokensGuardEvents<UserProvider[typeof PROVIDER_REAL_USER] & {
        currentAccessToken: AccessToken;
    }>>, userProvider: UserProvider);
    /**
     * Returns an instance of the authenticated user. Or throws
     * an exception if the request is not authenticated.
     */
    getUserOrFail(): UserProvider[typeof PROVIDER_REAL_USER] & {
        currentAccessToken: AccessToken;
    };
    /**
     * Authenticate the current HTTP request by verifying the bearer
     * token or fails with an exception
     */
    authenticate(): Promise<UserProvider[typeof PROVIDER_REAL_USER] & {
        currentAccessToken: AccessToken;
    }>;
    /**
     * Create a token for a user (sign in)
     */
    createToken(user: UserProvider[typeof PROVIDER_REAL_USER], abilities?: string[], options?: {
        expiresIn?: string | number;
        name?: string;
    }): Promise<AccessToken>;
    /**
     * Invalidates the currently authenticated token (sign out)
     */
    invalidateToken(): Promise<boolean>;
    /**
     * Returns the Authorization header clients can use to authenticate
     * the request.
     */
    authenticateAsClient(user: UserProvider[typeof PROVIDER_REAL_USER], abilities?: string[], options?: {
        expiresIn?: string | number;
        name?: string;
    }): Promise<AuthClientResponse>;
    /**
     * Silently check if the user is authenticated or not. The
     * method is same the "authenticate" method but does not
     * throw any exceptions.
     */
    check(): Promise<boolean>;
}
