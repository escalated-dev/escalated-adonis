import type { SessionData, SessionStoreContract } from './types.js';
/**
 * Session client exposes the API to set session data as a client
 */
export declare class SessionClient {
    #private;
    /**
     * Session key for setting flash messages
     */
    flashKey: string;
    /**
     * Session to use when no explicit session id is
     * defined
     */
    sessionId: string;
    constructor(store: SessionStoreContract);
    /**
     * Merge session data
     */
    merge(values: SessionData): this;
    /**
     * Merge flash messages
     */
    flash(values: SessionData): this;
    /**
     * Commits data to the session store.
     */
    commit(): Promise<void>;
    /**
     * Destroys the session data with the store
     */
    destroy(sessionId?: string): Promise<void>;
    /**
     * Loads session data from the session store
     */
    load(sessionId?: string): Promise<{
        values: any;
        flashMessages: any;
    }>;
}
