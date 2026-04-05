import type { GuardFactory } from './types.js';
/**
 * Authenticator client is used to create guard instances for testing.
 * It passes a fake HTTPContext to the guards, so make sure to not
 * call server side APIs that might be relying on a real
 * HTTPContext instance.
 */
export declare class AuthenticatorClient<KnownGuards extends Record<string, GuardFactory>> {
    #private;
    /**
     * Name of the default guard
     */
    get defaultGuard(): keyof KnownGuards;
    constructor(config: {
        default: keyof KnownGuards;
        guards: KnownGuards;
    });
    /**
     * Returns an instance of a known guard. Guards instances are
     * cached during the lifecycle of an HTTP request.
     */
    use<Guard extends keyof KnownGuards>(guard?: Guard): ReturnType<KnownGuards[Guard]>;
}
