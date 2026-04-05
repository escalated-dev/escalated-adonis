/**
 * @adonisjs/session
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import type { Connection } from '@adonisjs/redis/types';
import type { SessionStoreWithTaggingContract, SessionData, TaggedSession } from '../types.js';
/**
 * Redis store to read/write session to Redis
 */
export declare class RedisStore implements SessionStoreWithTaggingContract {
    #private;
    constructor(connection: Connection, age: string | number);
    /**
     * Returns session data
     */
    read(sessionId: string): Promise<SessionData | null>;
    /**
     * Write session values to redis
     */
    write(sessionId: string, values: Record<string, any>): Promise<void>;
    /**
     * Cleanup session by removing it
     */
    destroy(sessionId: string): Promise<void>;
    /**
     * Updates the value expiry
     */
    touch(sessionId: string): Promise<void>;
    /**
     * Tag a session with a user ID
     */
    tag(sessionId: string, userId: string): Promise<void>;
    /**
     * Get all sessions for a given user ID (tag)
     */
    tagged(userId: string): Promise<TaggedSession[]>;
}
