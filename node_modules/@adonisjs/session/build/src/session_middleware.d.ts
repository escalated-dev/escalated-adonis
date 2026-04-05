import { EmitterService } from '@adonisjs/core/types';
import type { NextFn } from '@adonisjs/core/types/http';
import { HttpContext } from '@adonisjs/core/http';
import { Session } from './session.js';
import type { SessionConfig, SessionStoreFactory } from './types.js';
/**
 * HttpContext augmentations
 */
declare module '@adonisjs/core/http' {
    interface HttpContext {
        session: Session;
    }
}
/**
 * Session middleware is used to initiate the session store
 * and commit its values during an HTTP request
 */
export default class SessionMiddleware<KnownStores extends Record<string, SessionStoreFactory>> {
    #private;
    constructor(config: SessionConfig & {
        store: keyof KnownStores;
        stores: KnownStores;
    }, emitter: EmitterService);
    handle(ctx: HttpContext, next: NextFn): Promise<any>;
}
