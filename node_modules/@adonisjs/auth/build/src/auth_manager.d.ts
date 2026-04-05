import type { HttpContext } from '@adonisjs/core/http';
import type { GuardFactory } from './types.js';
import { Authenticator } from './authenticator.js';
import { AuthenticatorClient } from './authenticator_client.js';
/**
 * Auth manager exposes the API to register and manage authentication
 * guards from the config
 */
export declare class AuthManager<KnownGuards extends Record<string, GuardFactory>> {
    config: {
        default: keyof KnownGuards;
        guards: KnownGuards;
    };
    /**
     * Name of the default guard
     */
    get defaultGuard(): keyof KnownGuards;
    constructor(config: {
        default: keyof KnownGuards;
        guards: KnownGuards;
    });
    /**
     * Create an authenticator for a given HTTP request. The authenticator
     * is used to authenticated in incoming HTTP request
     */
    createAuthenticator(ctx: HttpContext): Authenticator<KnownGuards>;
    /**
     * Creates an instance of the authenticator client. The client is
     * used to setup authentication state during testing.
     */
    createAuthenticatorClient(): AuthenticatorClient<KnownGuards>;
}
