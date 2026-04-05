import type { PluginFn } from '@japa/runner/types';
import type { ApplicationService } from '@adonisjs/core/types';
import type { Authenticators, GuardContract, GuardFactory } from '../../types.js';
declare module '@japa/api-client' {
    interface ApiRequest {
        authData: {
            guard: keyof Authenticators | '__default__';
            args: [unknown, ...any[]];
        };
        /**
         * Login a user using the default authentication guard
         * when making an API call
         */
        loginAs(...args: {
            [K in keyof Authenticators]: Authenticators[K] extends GuardFactory ? ReturnType<Authenticators[K]> extends GuardContract<unknown> ? Parameters<ReturnType<Authenticators[K]>['authenticateAsClient']> : never : never;
        }[keyof Authenticators]): this;
        /**
         * Define the authentication guard for login
         */
        withGuard<K extends keyof Authenticators, Self extends ApiRequest>(this: Self, guard: K): {
            /**
             * Login a user using a specific auth guard
             */
            loginAs(...args: ReturnType<Authenticators[K]> extends GuardContract<any> ? Parameters<ReturnType<Authenticators[K]>['authenticateAsClient']> : never): Self;
        };
    }
}
/**
 * Auth API client to authenticate users when making
 * HTTP requests using the Japa API client
 */
export declare const authApiClient: (app: ApplicationService) => PluginFn;
