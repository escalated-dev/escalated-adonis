import type { PluginFn } from '@japa/runner/types';
import type { ApplicationService } from '@adonisjs/core/types';
import type { Authenticators, GuardContract, GuardFactory } from '../../types.js';
declare module 'playwright' {
    interface BrowserContext {
        /**
         * Login a user using the default authentication guard when
         * using the browser context to make page visits
         */
        loginAs(...args: {
            [K in keyof Authenticators]: Authenticators[K] extends GuardFactory ? ReturnType<Authenticators[K]> extends GuardContract<unknown> ? Parameters<ReturnType<Authenticators[K]>['authenticateAsClient']> : never : never;
        }[keyof Authenticators]): Promise<void>;
        /**
         * Define the authentication guard for login
         */
        withGuard<K extends keyof Authenticators>(guard: K): {
            /**
             * Login a user using a specific auth guard
             */
            loginAs(...args: ReturnType<Authenticators[K]> extends GuardContract<unknown> ? Parameters<ReturnType<Authenticators[K]>['authenticateAsClient']> : never): Promise<void>;
        };
    }
}
/**
 * Browser API client to authenticate users when making
 * HTTP requests using the Japa Browser client.
 */
export declare const authBrowserClient: (app: ApplicationService) => PluginFn;
