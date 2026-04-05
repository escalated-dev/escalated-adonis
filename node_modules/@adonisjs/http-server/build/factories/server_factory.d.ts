import { Logger } from '@adonisjs/logger';
import { Emitter } from '@adonisjs/events';
import type { Encryption } from '@adonisjs/encryption';
import type { Application } from '@adonisjs/application';
import { Server } from '../src/server/main.js';
import type { ServerConfig } from '../src/types/server.js';
type FactoryParameters = {
    app: Application<any>;
    logger: Logger;
    encryption: Encryption;
    emitter: Emitter<any>;
    config: Partial<ServerConfig>;
};
/**
 * Server factory is used to generate server class instances for
 * testing
 */
export declare class ServerFactory {
    #private;
    /**
     * Merge factory params
     */
    merge(params: Partial<FactoryParameters>): this;
    /**
     * Create server instance
     */
    create(): Server;
}
export {};
