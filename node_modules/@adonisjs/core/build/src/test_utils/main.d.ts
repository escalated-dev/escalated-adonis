import Macroable from '@poppinss/macroable';
import { IncomingMessage, ServerResponse } from 'node:http';
import { HttpServerUtils } from './http.js';
import type { ApplicationService } from '../types.js';
import { CookieClient, type HttpContext } from '../../modules/http/main.js';
/**
 * Test utils has a collection of helper methods to make testing
 * experience great for AdonisJS applications
 */
export declare class TestUtils extends Macroable {
    #private;
    app: ApplicationService;
    /**
     * Check if utils have been booted
     */
    get isBooted(): boolean;
    cookies: CookieClient;
    constructor(app: ApplicationService);
    /**
     * Boot test utils. It requires the app to be booted
     * and container to have all the bindings
     */
    boot(): Promise<void>;
    /**
     * Returns an instance of the HTTP server testing
     * utils
     */
    httpServer(): HttpServerUtils;
    /**
     * Create an instance of HTTP context for testing
     */
    createHttpContext(options?: {
        req?: IncomingMessage;
        res?: ServerResponse;
    }): Promise<HttpContext>;
}
