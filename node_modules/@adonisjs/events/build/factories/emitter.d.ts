import type { Application } from '@adonisjs/application';
import { Emitter } from '../src/emitter.js';
/**
 * Emitter factory is used to create an instance of emitter
 * for testing
 */
export declare class EmitterFactory {
    /**
     * Create emitter instance
     */
    create(app: Application<any>): Emitter<Record<string | number | symbol, any>>;
}
