import type { Encryption } from '@adonisjs/encryption';
import type { Application } from '@adonisjs/application';
import type { Qs } from '../qs.js';
import { Route } from './route.js';
import { RouteGroup } from './group.js';
import { BriskRoute } from './brisk.js';
import { RouteResource } from './resource.js';
import { LookupStore } from './lookup_store/main.js';
import { RouteMatchers as Matchers } from './matchers.js';
import type { Constructor, LazyImport } from '../types/base.js';
import type { MiddlewareAsClass, ParsedGlobalMiddleware } from '../types/middleware.js';
import type { RouteFn, MatchedRoute, RouteMatcher, RouteMatchers, MakeUrlOptions, MakeSignedUrlOptions, GetControllerHandlers } from '../types/route.js';
/**
 * Router class exposes a unified API to register new routes, group them or
 * create route resources.
 *
 * ```ts
 * const router = new Router()
 *
 * router.get('/', async function () {
 *   // handle request
 * })
 * ```
 */
export declare class Router extends LookupStore {
    #private;
    /**
     * Collection of routes, including route resource and route
     * group. To get a flat list of routes, call `router.toJSON()`
     */
    routes: (Route | RouteResource | RouteGroup | BriskRoute)[];
    /**
     * A flag to know if routes for explicit domains have been registered.
     * The boolean is computed after calling the "commit" method.
     */
    usingDomains: boolean;
    /**
     * Shortcut methods for commonly used route matchers
     */
    matchers: Matchers;
    /**
     * Check if routes have been committed to the store. Once
     * routes are committed, defining new set of routes will
     * have no impact
     */
    get commited(): boolean;
    constructor(app: Application<any>, encryption: Encryption, qsParser: Qs);
    /**
     * Parses the route pattern
     */
    parsePattern(pattern: string, matchers?: RouteMatchers): import("../types/route.js").MatchItRouteToken[];
    /**
     * Define an array of middleware to use on all the routes.
     * Calling this method multiple times pushes to the
     * existing list of middleware
     */
    use(middleware: LazyImport<MiddlewareAsClass>[]): this;
    /**
     * Define a collection of named middleware. The defined collection is
     * not registered anywhere, but instead converted in a new collection
     * of functions you can apply on the routes, or router groups.
     */
    named<NamedMiddleware extends Record<string, LazyImport<MiddlewareAsClass>>>(collection: NamedMiddleware): { [K in keyof NamedMiddleware]: <Args extends import("../types/middleware.js").GetMiddlewareArgs<import("../types/base.js").UnWrapLazyImport<NamedMiddleware[K]>>>(...args: Args) => {
        name: K;
        args: Args[0];
        handle: ParsedGlobalMiddleware["handle"];
    }; };
    /**
     * Add route for a given pattern and methods
     */
    route<T extends Constructor<any>>(pattern: string, methods: string[], handler: string | RouteFn | [LazyImport<T> | T, GetControllerHandlers<T>?]): Route<T>;
    /**
     * Define a route that handles all common HTTP methods
     */
    any<T extends Constructor<any>>(pattern: string, handler: string | RouteFn | [LazyImport<T> | T, GetControllerHandlers<T>?]): Route<T>;
    /**
     * Define `GET` route
     */
    get<T extends Constructor<any>>(pattern: string, handler: string | RouteFn | [LazyImport<T> | T, GetControllerHandlers<T>?]): Route<T>;
    /**
     * Define `POST` route
     */
    post<T extends Constructor<any>>(pattern: string, handler: string | RouteFn | [LazyImport<T> | T, GetControllerHandlers<T>?]): Route<T>;
    /**
     * Define `PUT` route
     */
    put<T extends Constructor<any>>(pattern: string, handler: string | RouteFn | [LazyImport<T> | T, GetControllerHandlers<T>?]): Route<T>;
    /**
     * Define `PATCH` route
     */
    patch<T extends Constructor<any>>(pattern: string, handler: string | RouteFn | [LazyImport<T> | T, GetControllerHandlers<T>?]): Route<T>;
    /**
     * Define `DELETE` route
     */
    delete<T extends Constructor<any>>(pattern: string, handler: string | RouteFn | [LazyImport<T> | T, GetControllerHandlers<T>?]): Route<T>;
    /**
     * Creates a group of routes. A route group can apply transforms
     * to routes in bulk
     */
    group(callback: () => void): RouteGroup;
    /**
     * Registers a route resource with conventional set of routes
     */
    resource(resource: string, controller: string | LazyImport<Constructor<any>> | Constructor<any>): RouteResource<import("../types/route.js").ResourceActionNames>;
    /**
     * Register a route resource with shallow nested routes.
     */
    shallowResource(resource: string, controller: string | LazyImport<Constructor<any>> | Constructor<any>): RouteResource<import("../types/route.js").ResourceActionNames>;
    /**
     * Returns a brisk route instance for a given URL pattern
     */
    on(pattern: string): BriskRoute;
    /**
     * Define matcher for a given param. The global params are applied
     * on all the routes (unless overridden at the route level).
     */
    where(param: string, matcher: RouteMatcher | string | RegExp): this;
    /**
     * Commit routes to the store. The router is freezed after the
     * commit method is called.
     */
    commit(): void;
    /**
     * Find route for a given URL, method and optionally domain
     */
    match(url: string, method: string, hostname?: string | null): null | MatchedRoute;
    /**
     * Make URL to a pre-registered route
     */
    makeUrl(routeIdentifier: string, params?: any[] | Record<string, any>, options?: MakeUrlOptions): string;
    /**
     * Makes a signed URL to a pre-registered route.
     */
    makeSignedUrl(routeIdentifier: string, params?: any[] | Record<string, any>, options?: MakeSignedUrlOptions): string;
}
