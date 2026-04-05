import type { TestUtils } from './main.js';
import type { Server as NodeHttpsServer } from 'node:https';
import { IncomingMessage, ServerResponse, Server as NodeHttpServer } from 'node:http';
/**
 * Http server utils are used to start the AdonisJS HTTP server
 * during testing
 */
export declare class HttpServerUtils {
    #private;
    constructor(utils: TestUtils);
    /**
     * Testing hook to start the HTTP server to listen for new request.
     * The return value is a function to close the HTTP server.
     */
    start(serverCallback?: (handler: (req: IncomingMessage, res: ServerResponse) => any) => NodeHttpsServer | NodeHttpServer): Promise<() => Promise<void>>;
}
