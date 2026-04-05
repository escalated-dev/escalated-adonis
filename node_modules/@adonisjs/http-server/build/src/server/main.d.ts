import type { Logger } from '@adonisjs/logger';
import type { Encryption } from '@adonisjs/encryption';
import type { Server as HttpsServer } from 'node:https';
import type { Application } from '@adonisjs/application';
import type { EmitterLike } from '@adonisjs/events/types';
import { type ContainerResolver } from '@adonisjs/fold';
import type { ServerResponse, IncomingMessage, Server as HttpServer } from 'node:http';
import type { LazyImport } from '../types/base.js';
import type { MiddlewareAsClass } from '../types/middleware.js';
import type { ServerConfig, HttpServerEvents, ErrorHandlerAsAClass, TestingMiddlewarePipeline } from '../types/server.js';
import { Request } from '../request.js';
import { Response } from '../response.js';
import { Router } from '../router/main.js';
import { HttpContext } from '../http_context/main.js';
/**
 * The HTTP server implementation to handle incoming requests and respond using the
 * registered routes.
 */
export declare class Server {
    #private;
    /**
     * Check if the server has already been booted
     */
    get booted(): boolean;
    /**
     * Know if async local storage is enabled or not.
     */
    get usingAsyncLocalStorage(): boolean;
    constructor(app: Application<any>, encryption: Encryption, emitter: EmitterLike<HttpServerEvents>, logger: Logger, config: ServerConfig);
    /**
     * Creates a pipeline of middleware.
     */
    pipeline(middleware: MiddlewareAsClass[]): TestingMiddlewarePipeline;
    /**
     * Define an array of middleware to use on all the incoming HTTP request.
     * Calling this method multiple times pushes to the existing list
     * of middleware
     */
    use(middleware: LazyImport<MiddlewareAsClass>[]): this;
    /**
     * Register a custom error handler for HTTP requests.
     * All errors will be reported to this method
     */
    errorHandler(handler: LazyImport<ErrorHandlerAsAClass>): this;
    /**
     * Boot the server. Calling this method performs the following actions.
     *
     * - Register routes with the store.
     * - Resolve and construct the error handler.
     */
    boot(): Promise<void>;
    /**
     * Set the HTTP server instance used to listen for requests.
     */
    setNodeServer(server: HttpServer | HttpsServer): void;
    /**
     * Returns reference to the underlying HTTP server
     * in use
     */
    getNodeServer(): HttpServer<typeof IncomingMessage, typeof ServerResponse> | HttpsServer<typeof IncomingMessage, typeof ServerResponse> | undefined;
    /**
     * Returns reference to the router instance used
     * by the server.
     */
    getRouter(): Router;
    /**
     * Creates an instance of the [[Request]] class
     */
    createRequest(req: IncomingMessage, res: ServerResponse): Request;
    /**
     * Creates an instance of the [[Response]] class
     */
    createResponse(req: IncomingMessage, res: ServerResponse): Response;
    /**
     * Creates an instance of the [[HttpContext]] class
     */
    createHttpContext(request: Request, response: Response, resolver: ContainerResolver<any>): HttpContext;
    /**
     * Handle request
     */
    handle(req: IncomingMessage, res: ServerResponse): Promise<any>;
}
