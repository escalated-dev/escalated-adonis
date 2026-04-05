import type { Logger } from '@adonisjs/logger';
import type { Request } from '../src/request.js';
import type { Response } from '../src/response.js';
import { HttpContext } from '../src/http_context/main.js';
type FactoryParameters = {
    request: Request;
    response: Response;
    logger: Logger;
};
/**
 * HttpContext factory is used to generate Http context class instances for
 * testing
 */
export declare class HttpContextFactory {
    #private;
    /**
     * Merge factory params
     */
    merge(params: Partial<FactoryParameters>): this;
    /**
     * Create request
     */
    create(): HttpContext;
}
export {};
