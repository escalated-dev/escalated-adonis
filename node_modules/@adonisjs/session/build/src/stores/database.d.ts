/**
 * @adonisjs/session
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import type { QueryClientContract } from '@adonisjs/lucid/types/database';
import type { SessionStoreWithTaggingContract, SessionData, TaggedSession } from '../types.js';
/**
 * Database store to read/write session to SQL databases using Lucid
 */
export declare class DatabaseStore implements SessionStoreWithTaggingContract {
    #private;
    constructor(client: QueryClientContract, age: string | number, options?: {
        /**
         * Defaults to "sessions"
         */
        tableName?: string;
        /**
         * The probability (in percent) that garbage collection will be
         * triggered on any given request. For example, 2 means 2% chance.
         *
         * Set to 0 to disable garbage collection.
         *
         * Defaults to 2 (2% chance)
         */
        gcProbability?: number;
    });
    /**
     * Returns session data
     */
    read(sessionId: string): Promise<SessionData | null>;
    /**
     * Write session values to the database
     */
    write(sessionId: string, values: Object): Promise<void>;
    /**
     * Cleanup session by removing it
     */
    destroy(sessionId: string): Promise<void>;
    /**
     * Updates the session expiry
     */
    touch(sessionId: string): Promise<void>;
    /**
     * Tag a session with a user ID.
     * Uses UPSERT to handle both existing and new sessions.
     */
    tag(sessionId: string, userId: string): Promise<void>;
    /**
     * Get all sessions for a given user ID (tag)
     */
    tagged(userId: string): Promise<TaggedSession[]>;
}
