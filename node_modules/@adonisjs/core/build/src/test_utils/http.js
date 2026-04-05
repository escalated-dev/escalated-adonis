/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import debug from '../debug.js';
import { createServer } from 'node:http';
/**
 * Http server utils are used to start the AdonisJS HTTP server
 * during testing
 */
export class HttpServerUtils {
    #utils;
    constructor(utils) {
        this.#utils = utils;
    }
    /**
     * Starts the http server a given host and port
     */
    #listen(nodeHttpServer) {
        return new Promise((resolve, reject) => {
            const host = process.env.HOST || '0.0.0.0';
            const port = Number(process.env.PORT || '3333');
            nodeHttpServer.listen(port, host);
            nodeHttpServer.once('listening', () => {
                debug('listening to utils http server, host :%s, port: %s', host, port);
                resolve({ port, host });
            });
            nodeHttpServer.once('error', (error) => {
                reject(error);
            });
        });
    }
    /**
     * Testing hook to start the HTTP server to listen for new request.
     * The return value is a function to close the HTTP server.
     */
    async start(serverCallback) {
        const createHTTPServer = serverCallback || createServer;
        const server = await this.#utils.app.container.make('server');
        await server.boot();
        const httpServer = createHTTPServer(server.handle.bind(server));
        server.setNodeServer(httpServer);
        await this.#listen(httpServer);
        return () => {
            return new Promise((resolve, reject) => {
                httpServer.close((error) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            });
        };
    }
}
