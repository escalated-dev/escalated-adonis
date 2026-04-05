import type { Encryption } from '@adonisjs/encryption';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Request } from '../src/request.js';
import { RequestConfig } from '../src/types/request.js';
type FactoryParameters = {
    url: string;
    method: string;
    req: IncomingMessage;
    res: ServerResponse;
    encryption: Encryption;
    config: Partial<RequestConfig>;
};
/**
 * Request factory is used to generate request class instances for
 * testing
 */
export declare class RequestFactory {
    #private;
    /**
     * Merge factory params
     */
    merge(params: Partial<FactoryParameters>): this;
    /**
     * Create request
     */
    create(): Request;
}
export {};
