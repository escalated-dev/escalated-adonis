/**
 * @adonisjs/session
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import type { SessionData, SessionStoreWithTaggingContract, TaggedSession } from '../types.js';
/**
 * Memory store is meant to be used for writing tests.
 */
export declare class MemoryStore implements SessionStoreWithTaggingContract {
    static sessions: Map<string, SessionData>;
    /**
     * Maps session IDs to user IDs (for tagging)
     */
    static tags: Map<string, string>;
    /**
     * Read session id value from the memory
     */
    read(sessionId: string): SessionData | null;
    /**
     * Save in memory value for a given session id
     */
    write(sessionId: string, values: SessionData): void;
    /**
     * Cleanup for a single session
     */
    destroy(sessionId: string): void;
    touch(): void;
    /**
     * Tag a session with a user ID
     */
    tag(sessionId: string, userId: string): Promise<void>;
    /**
     * Get all sessions for a given user ID (tag)
     */
    tagged(userId: string): Promise<TaggedSession[]>;
}
