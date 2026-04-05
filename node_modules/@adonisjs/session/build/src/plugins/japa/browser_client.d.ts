import type { PluginFn } from '@japa/runner/types';
import type { ApplicationService } from '@adonisjs/core/types';
import type { CookieOptions as AdonisCookieOptions } from '@adonisjs/core/types/http';
import { SessionClient } from '../../client.js';
import type { SessionData } from '../../types.js';
declare module 'playwright' {
    interface BrowserContext {
        sessionClient: SessionClient;
        /**
         * Initiate session. The session id cookie will be defined
         * if missing
         */
        initiateSession(options?: Partial<AdonisCookieOptions>): Promise<void>;
        /**
         * Returns data from the session store
         */
        getSession(): Promise<any>;
        /**
         * Returns data from the session store
         */
        getFlashMessages(): Promise<any>;
        /**
         * Set session data
         */
        setSession(values: SessionData): Promise<void>;
        /**
         * Set flash messages
         */
        setFlashMessages(values: SessionData): Promise<void>;
    }
}
/**
 * Hooks AdonisJS Session with the Japa browser client
 * plugin
 */
export declare const sessionBrowserClient: (app: ApplicationService) => PluginFn;
