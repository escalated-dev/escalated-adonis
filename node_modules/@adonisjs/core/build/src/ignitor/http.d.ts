import type { Server as NodeHttpsServer } from 'node:https';
import { IncomingMessage, ServerResponse, Server as NodeHttpServer } from 'node:http';
import { Ignitor } from './main.js';
/**
 * The HTTP server process is used to start the application in the
 * web environment.
 */
export declare class HttpServerProcess {
    #private;
    constructor(ignitor: Ignitor);
    /**
     * Start the HTTP server by wiring up the application
     */
    start(serverCallback?: (handler: (req: IncomingMessage, res: ServerResponse) => any) => NodeHttpsServer | NodeHttpServer): Promise<void>;
}
