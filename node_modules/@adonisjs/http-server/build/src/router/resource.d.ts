import Macroable from '@poppinss/macroable';
import type { Application } from '@adonisjs/application';
import { Route } from './route.js';
import type { Constructor, LazyImport, OneOrMore } from '../types/base.js';
import type { MiddlewareFn, ParsedGlobalMiddleware, ParsedNamedMiddleware } from '../types/middleware.js';
import type { ResourceActionNames, RouteMatcher, RouteMatchers } from '../types/route.js';
/**
 * Route resource exposes the API to register multiple routes for a resource.
 */
export declare class RouteResource<ActionNames extends ResourceActionNames = ResourceActionNames> extends Macroable {
    #private;
    /**
     * A collection of routes instances that belongs to this resource
     */
    routes: Route[];
    constructor(app: Application<any>, routerMiddleware: ParsedGlobalMiddleware[], options: {
        resource: string;
        controller: string | LazyImport<Constructor<any>> | Constructor<any>;
        globalMatchers: RouteMatchers;
        shallow: boolean;
    });
    /**
     * Register only given routes and remove others
     */
    only<Name extends ActionNames>(names: Name[]): RouteResource<Name>;
    /**
     * Register all routes, except the one's defined
     */
    except<Name extends ActionNames>(names: Name[]): RouteResource<Exclude<ActionNames, Name>>;
    /**
     * Register api only routes. The `create` and `edit` routes, which
     * are meant to show forms will not be registered
     */
    apiOnly(): RouteResource<Exclude<ActionNames, 'create' | 'edit'>>;
    /**
     * Define matcher for params inside the resource
     */
    where(key: string, matcher: RouteMatcher | string | RegExp): this;
    /**
     * Tap into multiple routes to configure them by their name
     */
    tap(callback: (route: Route) => void): this;
    tap(actions: ActionNames | ActionNames[], callback: (route: Route) => void): this;
    /**
     * Set the param name for a given resource
     */
    params(resources: {
        [resource: string]: string;
    }): this;
    /**
     * Define one or more middleware on the routes created by
     * the resource.
     *
     * Calling this method multiple times will append middleware
     * to existing list.
     */
    use(actions: ActionNames | ActionNames[] | '*', middleware: OneOrMore<MiddlewareFn | ParsedNamedMiddleware>): this;
    /**
     * @alias use
     */
    middleware(actions: ActionNames | ActionNames[] | '*', middleware: OneOrMore<MiddlewareFn | ParsedNamedMiddleware>): this;
    /**
     * Prepend name to all the routes
     */
    as(name: string, normalizeName?: boolean): this;
}
