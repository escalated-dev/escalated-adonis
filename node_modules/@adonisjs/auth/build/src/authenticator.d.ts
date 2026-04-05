import type { HttpContext } from '@adonisjs/core/http';
import type { GuardFactory } from './types.js';
/**
 * Authenticator is used to authenticate incoming HTTP requests
 * using one or more known guards.
 */
export declare class Authenticator<KnownGuards extends Record<string, GuardFactory>> {
    #private;
    /**
     * Name of the default guard
     */
    get defaultGuard(): keyof KnownGuards;
    /**
     * Reference to the guard using which the current
     * request has been authenticated.
     */
    get authenticatedViaGuard(): keyof KnownGuards | undefined;
    /**
     * A boolean to know if the current request has been authenticated. The
     * property returns false when "authenticate" or "authenticateUsing"
     * methods are not used.
     */
    get isAuthenticated(): boolean;
    /**
     * Reference to the currently authenticated user. The property returns
     * undefined when "authenticate" or "authenticateUsing" methods are
     * not used.
     */
    get user(): {
        [K in keyof KnownGuards]: ReturnType<KnownGuards[K]>['user'];
    }[keyof KnownGuards];
    /**
     * Whether or not the authentication has been attempted during
     * the current request. The property returns false when the
     * "authenticate" or "authenticateUsing" methods are not
     * used.
     */
    get authenticationAttempted(): boolean;
    constructor(ctx: HttpContext, config: {
        default: keyof KnownGuards;
        guards: KnownGuards;
    });
    /**
     * Returns an instance of the logged-in user or throws an
     * exception
     */
    getUserOrFail(): {
        [K in keyof KnownGuards]: ReturnType<ReturnType<KnownGuards[K]>['getUserOrFail']>;
    }[keyof KnownGuards];
    /**
     * Returns an instance of a known guard. Guards instances are
     * cached during the lifecycle of an HTTP request.
     */
    use<Guard extends keyof KnownGuards>(guard?: Guard): ReturnType<KnownGuards[Guard]>;
    /**
     * Authenticate current request using the default guard. Calling this
     * method multiple times triggers multiple authentication with the
     * guard.
     */
    authenticate(): Promise<{ [K in keyof KnownGuards]: ReturnType<ReturnType<KnownGuards[K]>["getUserOrFail"]>; }[keyof KnownGuards]>;
    /**
     * Silently attempt to authenticate the request using the default
     * guard. Calling this method multiple times triggers multiple
     * authentication with the guard.
     */
    check(): Promise<boolean>;
    /**
     * Authenticate the request using all of the mentioned guards
     * or the default guard.
     *
     * The authentication process will stop after any of the mentioned
     * guards is able to authenticate the request successfully.
     *
     * Otherwise, "E_UNAUTHORIZED_ACCESS" will be raised.
     */
    authenticateUsing(guards?: (keyof KnownGuards)[], options?: {
        loginRoute?: string;
    }): Promise<{
        [K in keyof KnownGuards]: ReturnType<ReturnType<KnownGuards[K]>['getUserOrFail']>;
    }[keyof KnownGuards]>;
    /**
     * Silently attempt to authenticate the request using all of the mentioned guards
     * or the default guard. Calling this method multiple times triggers multiple
     * authentication with the guard.
     */
    checkUsing(guards?: (keyof KnownGuards)[]): Promise<boolean>;
}
