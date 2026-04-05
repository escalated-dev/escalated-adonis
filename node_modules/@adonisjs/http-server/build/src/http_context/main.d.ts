import Macroable from '@poppinss/macroable';
import type { Logger } from '@adonisjs/logger';
import { ContainerResolver } from '@adonisjs/fold';
import type { Request } from '../request.js';
import type { Response } from '../response.js';
import type { StoreRouteNode } from '../types/route.js';
/**
 * Http context encapsulates properties for a given HTTP request. The
 * context class can be extended using macros and getters.
 */
export declare class HttpContext extends Macroable {
    request: Request;
    response: Response;
    logger: Logger;
    containerResolver: ContainerResolver<any>;
    /**
     * Find if async localstorage is enabled for HTTP requests
     * or not
     */
    static get usingAsyncLocalStorage(): boolean;
    /**
     * Get access to the HTTP context. Available only when
     * "usingAsyncLocalStorage" is true
     */
    static get(): HttpContext | null;
    /**
     * Get the HttpContext instance or raise an exception if not
     * available
     */
    static getOrFail(): HttpContext;
    /**
     * Run a method that doesn't have access to HTTP context from
     * the async local storage.
     */
    static runOutsideContext<T>(callback: (...args: any[]) => T, ...args: any[]): T;
    /**
     * Reference to the current route. Not available inside
     * server middleware
     */
    route?: StoreRouteNode;
    /**
     * A unique key for the current route
     */
    routeKey?: string;
    /**
     * Route params
     */
    params: Record<string, any>;
    /**
     * Route subdomains
     */
    subdomains: Record<string, any>;
    constructor(request: Request, response: Response, logger: Logger, containerResolver: ContainerResolver<any>);
    /**
     * A helper to see top level properties on the context object
     */
    inspect(): string;
}
