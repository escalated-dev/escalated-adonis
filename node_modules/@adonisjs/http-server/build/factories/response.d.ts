import type { Encryption } from '@adonisjs/encryption';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Response } from '../src/response.js';
import { Router } from '../src/router/main.js';
import { ResponseConfig } from '../src/types/response.js';
type FactoryParameters = {
    req: IncomingMessage;
    res: ServerResponse;
    encryption: Encryption;
    config: Partial<ResponseConfig>;
    router: Router;
};
/**
 * Response factory is used to generate response class instances for
 * testing
 */
export declare class ResponseFactory {
    #private;
    /**
     * Merge factory params
     */
    merge(params: Partial<FactoryParameters>): this;
    /**
     * Create response class instance
     */
    create(): Response;
}
export {};
