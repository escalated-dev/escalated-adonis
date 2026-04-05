import type { HttpContext } from '@adonisjs/core/http';
import type { CookieOptions } from '@adonisjs/core/types/http';
import type { SessionData, SessionStoreContract } from '../types.js';
/**
 * Cookie store stores the session data inside an encrypted
 * cookie.
 */
export declare class CookieStore implements SessionStoreContract {
    #private;
    constructor(config: Partial<CookieOptions>, ctx: HttpContext);
    /**
     * Read session value from the cookie
     */
    read(sessionId: string): SessionData | null;
    /**
     * Write session values to the cookie
     */
    write(sessionId: string, values: SessionData): void;
    /**
     * Removes the session cookie
     */
    destroy(sessionId: string): void;
    /**
     * Updates the cookie with existing cookie values
     */
    touch(sessionId: string): void;
}
