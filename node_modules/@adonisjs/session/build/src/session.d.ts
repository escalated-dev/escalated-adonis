import Macroable from '@poppinss/macroable';
import type { HttpContext } from '@adonisjs/core/http';
import type { EmitterService } from '@adonisjs/core/types';
import type { HttpError } from '@adonisjs/core/types/http';
import { ValuesStore } from './values_store.js';
import type { SessionData, SessionConfig, SessionStoreFactory, AllowedSessionValues } from './types.js';
/**
 * The session class exposes the API to read and write values to
 * the session store.
 *
 * A session instance is isolated between requests but
 * uses a centralized persistence store and
 */
export declare class Session extends Macroable {
    #private;
    config: SessionConfig;
    /**
     * Store of flash messages that be written during the
     * HTTP request
     */
    responseFlashMessages: ValuesStore;
    /**
     * Store of flash messages for the current HTTP request.
     */
    flashMessages: ValuesStore;
    /**
     * The key to use for storing flash messages inside
     * the session store.
     */
    flashKey: string;
    /**
     * Session id for the current HTTP request
     */
    get sessionId(): string;
    /**
     * A boolean to know if a fresh session is created during
     * the request
     */
    get fresh(): boolean;
    /**
     * A boolean to know if session is in readonly
     * state
     */
    get readonly(): boolean;
    /**
     * A boolean to know if session store has been initiated
     */
    get initiated(): boolean;
    /**
     * A boolean to know if the session id has been re-generated
     * during the current request
     */
    get hasRegeneratedSession(): boolean;
    /**
     * A boolean to know if the session store is empty
     */
    get isEmpty(): boolean;
    /**
     * A boolean to know if the session store has been
     * modified
     */
    get hasBeenModified(): boolean;
    constructor(config: SessionConfig, storeFactory: SessionStoreFactory, emitter: EmitterService, ctx: HttpContext);
    /**
     * Initiates the session store. The method results in a noop
     * when called multiple times
     */
    initiate(readonly: boolean): Promise<void>;
    /**
     * Put a key-value pair to the session data store
     */
    put(key: string, value: AllowedSessionValues): void;
    /**
     * Check if a key exists inside the datastore
     */
    has(key: string): boolean;
    /**
     * Get the value of a key from the session datastore.
     * You can specify a default value to use, when key
     * does not exists or has undefined value.
     */
    get(key: string, defaultValue?: any): any;
    /**
     * Get everything from the session store
     */
    all(): any;
    /**
     * Remove a key from the session datastore
     */
    forget(key: string): void;
    /**
     * Read value for a key from the session datastore
     * and remove it simultaneously.
     */
    pull(key: string, defaultValue?: any): any;
    /**
     * Increment the value of a key inside the session
     * store.
     *
     * A new key will be defined if does not exists already.
     * The value of a new key will be 1
     */
    increment(key: string, steps?: number): void;
    /**
     * Increment the value of a key inside the session
     * store.
     *
     * A new key will be defined if does not exists already.
     * The value of a new key will be -1
     */
    decrement(key: string, steps?: number): void;
    /**
     * Empty the session store
     */
    clear(): void;
    /**
     * Add a key-value pair to flash messages
     */
    flash(key: string, value: AllowedSessionValues): void;
    flash(keyValue: SessionData): void;
    /**
     * Flash errors to the errorsBag. You can read these
     * errors via the "@error" tag.
     *
     * Appends new messages to the existing collection.
     */
    flashErrors(errorsCollection: Record<string, string | string[]>): void;
    /**
     * Flash validation error messages. Make sure the error
     * is an instance of VineJS ValidationException.
     *
     * Overrides existing inputErrors
     */
    flashValidationErrors(error: HttpError): void;
    /**
     * Flash form input data to the flash messages store
     */
    flashAll(): void;
    /**
     * Flash form input data (except some keys) to the flash messages store
     */
    flashExcept(keys: string[]): void;
    /**
     * Flash form input data (only some keys) to the flash messages store
     */
    flashOnly(keys: string[]): void;
    /**
     * Reflash messages from the last request in the current response
     */
    reflash(): void;
    /**
     * Reflash messages (only some keys) from the last
     * request in the current response
     */
    reflashOnly(keys: string[]): void;
    /**
     * Reflash messages (except some keys) from the last
     * request in the current response
     */
    reflashExcept(keys: string[]): void;
    /**
     * Re-generate the session id and migrate data to it.
     */
    regenerate(): void;
    /**
     * Tag the current session with a user ID. This allows you to
     * later retrieve all sessions for a given user via SessionCollection.
     *
     * Only Memory, Redis and Database stores support tagging. Other stores
     * will throw an error.
     */
    tag(userId: string): Promise<void>;
    /**
     * Commit session changes. No more mutations will be
     * allowed after commit.
     */
    commit(): Promise<void>;
}
