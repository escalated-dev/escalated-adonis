import type { PluginFn } from '@japa/runner/types';
import type { ApplicationService } from '@adonisjs/core/types';
import { SessionClient } from '../../client.js';
import type { SessionData } from '../../types.js';
declare module '@japa/api-client' {
    interface ApiRequest {
        sessionClient: SessionClient;
        /**
         * Make HTTP request along with the provided session data
         */
        withSession(values: SessionData): this;
        /**
         * Make HTTP request along with the provided session flash
         * messages.
         */
        withFlashMessages(values: SessionData): this;
    }
    interface ApiResponse {
        sessionBag: {
            values: SessionData;
            flashMessages: SessionData;
        };
        /**
         * Get session data from the HTTP response
         */
        session(key?: string): any;
        /**
         * Get flash messages from the HTTP response
         */
        flashMessages(): SessionData;
        /**
         * Get flash messages for a specific key from the HTTP response
         */
        flashMessage(key: string): SessionData;
        /**
         * Assert session key-value pair exists
         */
        assertSession(key: string, value?: any): void;
        /**
         * Assert key is missing in session store
         */
        assertSessionMissing(key: string): void;
        /**
         * Assert flash message key-value pair exists
         */
        assertFlashMessage(key: string, value?: any): void;
        /**
         * Assert key is missing flash messages store
         */
        assertFlashMissing(key: string): void;
        /**
         * Assert flash messages has validation errors for
         * the given field
         */
        assertHasValidationError(field: string): void;
        /**
         * Assert flash messages does not have validation errors
         * for the given field
         */
        assertDoesNotHaveValidationError(field: string): void;
        /**
         * Assert error message for a given field
         */
        assertValidationError(field: string, message: string): void;
        /**
         * Assert all error messages for a given field
         */
        assertValidationErrors(field: string, messages: string[]): void;
    }
}
/**
 * Hooks AdonisJS Session with the Japa API client
 * plugin
 */
export declare const sessionApiClient: (app: ApplicationService) => PluginFn;
