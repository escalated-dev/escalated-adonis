import Macroable from '@poppinss/macroable';
import type { Application } from '@adonisjs/application';
import { Route } from './route.js';
import type { ParsedGlobalMiddleware } from '../types/middleware.js';
import type { MakeUrlOptions, RouteFn, RouteMatchers } from '../types/route.js';
/**
 * Brisk routes exposes the API to configure the route handler by chaining
 * one of the pre-defined methods.
 *
 * For example: Instead of defining the redirect logic as a callback, one can
 * chain the `.redirect` method.
 *
 * Brisk routes are always registered under the `GET` HTTP method.
 */
export declare class BriskRoute extends Macroable {
    #private;
    /**
     * Reference to route instance. Set after `setHandler` is called
     */
    route: null | Route;
    constructor(app: Application<any>, routerMiddleware: ParsedGlobalMiddleware[], options: {
        pattern: string;
        globalMatchers: RouteMatchers;
    });
    /**
     * Set handler for the brisk route
     */
    setHandler(handler: RouteFn): Route;
    /**
     * Redirects to a given route. Params from the original request will
     * be used when no custom params are defined.
     */
    redirect(identifier: string, params?: any[] | Record<string, any>, options?: MakeUrlOptions & {
        status: number;
    }): Route;
    /**
     * Redirect request to a fixed URL
     */
    redirectToPath(url: string, options?: {
        status: number;
    }): Route;
}
