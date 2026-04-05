import type { Application } from '@adonisjs/core/app';
import type { Codemods } from '@adonisjs/core/ace/codemods';
/**
 * Collection of configurable guards
 */
export declare const GUARDS: {
    session: {
        name: string;
        description: string;
    };
    access_tokens: {
        name: string;
        description: string;
    };
    basic_auth: {
        name: string;
        description: string;
    };
};
/**
 * Configures the "@adonisjs/auth" package with one of the
 * bundled guards and user providers
 */
export declare function presetAuth(codemods: Codemods, app: Application<any>, options: {
    guard: keyof typeof GUARDS;
    userProvider: 'lucid';
}): Promise<void>;
