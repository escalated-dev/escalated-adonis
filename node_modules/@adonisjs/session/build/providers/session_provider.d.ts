import type { ApplicationService } from '@adonisjs/core/types';
import type { Session } from '../src/session.js';
/**
 * Events emitted by the session class
 */
declare module '@adonisjs/core/types' {
    interface EventsList {
        'session:initiated': {
            session: Session;
        };
        'session:committed': {
            session: Session;
        };
        'session:migrated': {
            fromSessionId: string;
            toSessionId: string;
            session: Session;
        };
    }
}
/**
 * Session provider configures the session management inside an
 * AdonisJS application
 */
export default class SessionProvider {
    #private;
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    /**
     * Registers edge plugin when edge is installed
     * in the user application.
     */
    protected registerEdgePlugin(): Promise<void>;
    /**
     * Registering bindings
     */
    register(): void;
    /**
     * Adding edge tags (if edge is installed)
     */
    boot(): Promise<void>;
}
