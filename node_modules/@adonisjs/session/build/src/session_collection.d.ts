/**
 * @adonisjs/session
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import type { ResolvedSessionConfig, SessionData, TaggedSession } from './types.js';
/**
 * SessionCollection provides APIs for programmatic session
 * management. It allows reading, destroying, and tagging
 * sessions without an HTTP context.
 *
 * @example
 * ```ts
 * import app from '@adonisjs/core/services/app'
 * import { SessionCollection } from '@adonisjs/session'
 *
 * const sessionCollection = await app.container.make(SessionCollection)
 *
 * // List all sessions for a user
 * const sessions = await sessionCollection.tagged(String(user.id))
 *
 * // Destroy a specific session
 * await sessionCollection.destroy(sessionId)
 * ```
 */
export declare class SessionCollection {
    #private;
    constructor(config: ResolvedSessionConfig);
    /**
     * Check if the current store supports tagging
     */
    supportsTagging(): boolean;
    /**
     * Returns the session data for the given session ID,
     * or null if the session does not exist
     */
    get(sessionId: string): Promise<SessionData | null>;
    /**
     * Destroys a session by its ID
     */
    destroy(sessionId: string): Promise<void>;
    /**
     * Tag a session with a user ID.
     * Only supported by Memory, Redis and Database stores.
     */
    tag(sessionId: string, userId: string): Promise<void>;
    /**
     * Get all sessions for a given user ID (tag).
     * Only supported by Memory, Redis and Database stores.
     */
    tagged(userId: string): Promise<TaggedSession[]>;
}
