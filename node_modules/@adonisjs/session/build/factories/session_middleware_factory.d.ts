import { Emitter } from '@adonisjs/core/events';
import type { EventsList } from '@adonisjs/core/types';
import SessionMiddleware from '../src/session_middleware.js';
import type { SessionConfig, SessionStoreFactory } from '../src/types.js';
/**
 * Exposes the API to create an instance of the session middleware
 * without additional plumbing
 */
export declare class SessionMiddlewareFactory {
    #private;
    /**
     * Merge custom options
     */
    merge(options: {
        config?: Partial<SessionConfig> & {
            store: string;
            stores: Record<string, SessionStoreFactory>;
        };
        emitter?: Emitter<EventsList>;
    }): this;
    /**
     * Creates an instance of the session middleware
     */
    create(): Promise<SessionMiddleware<{
        [x: string]: SessionStoreFactory;
    }>>;
}
