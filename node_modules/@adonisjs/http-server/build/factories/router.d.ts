import type { Encryption } from '@adonisjs/encryption';
import type { Application } from '@adonisjs/application';
import { Router } from '../src/router/main.js';
type FactoryParameters = {
    app: Application<any>;
    encryption: Encryption;
};
/**
 * Router factory is used to generate router class instances for
 * testing
 */
export declare class RouterFactory {
    #private;
    /**
     * Merge factory params
     */
    merge(params: Partial<FactoryParameters>): this;
    /**
     * Create router instance
     */
    create(): Router;
}
export {};
