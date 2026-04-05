import type { IncomingMessage } from 'node:http';
import type { Qs } from './qs.js';
import type { Response } from './response.js';
import type { Router } from './router/main.js';
import type { MakeUrlOptions } from './types/route.js';
/**
 * Exposes the API to construct redirect routes
 */
export declare class Redirect {
    #private;
    constructor(request: IncomingMessage, response: Response, router: Router, qs: Qs);
    /**
     * Set a custom status code.
     */
    status(statusCode: number): this;
    /**
     * Clearing query string values added using the
     * "withQs" method
     */
    clearQs(): this;
    /**
     * Define query string for the redirect. Not passing
     * any value will forward the current request query
     * string.
     */
    withQs(): this;
    withQs(values: Record<string, any>): this;
    withQs(name: string, value: any): this;
    /**
     * Redirect to the previous path.
     */
    back(): void;
    /**
     * Redirect the request using a route identifier.
     */
    toRoute(routeIdentifier: string, params?: any[] | Record<string, any>, options?: MakeUrlOptions): void;
    /**
     * Redirect the request using a path.
     */
    toPath(url: string): void;
}
