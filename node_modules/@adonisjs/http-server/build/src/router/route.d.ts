import Macroable from '@poppinss/macroable';
import type { Application } from '@adonisjs/application';
import type { Constructor, LazyImport, OneOrMore } from '../types/base.js';
import type { MiddlewareFn, ParsedNamedMiddleware, ParsedGlobalMiddleware } from '../types/middleware.js';
import type { GetControllerHandlers, RouteFn, RouteJSON, RouteMatcher, RouteMatchers, StoreRouteMiddleware } from '../types/route.js';
/**
 * The route class exposes the APIs for constructing a route using the
 * fluent API.
 */
export declare class Route<Controller extends Constructor<any> = any> extends Macroable {
    #private;
    constructor(app: Application<any>, routerMiddleware: ParsedGlobalMiddleware[], options: {
        pattern: string;
        methods: string[];
        handler: RouteFn | string | [LazyImport<Controller> | Controller, GetControllerHandlers<Controller>?];
        globalMatchers: RouteMatchers;
    });
    /**
     * Define matcher for a given param. If a matcher exists, then we do not
     * override that, since the routes inside a group will set matchers
     * before the group, so they should have priority over the group
     * matchers.
     *
     * ```ts
     * Route.group(() => {
     *   Route.get('/:id', 'handler').where('id', /^[0-9]$/)
     * }).where('id', /[^a-z$]/)
     * ```
     *
     * The `/^[0-9]$/` will win over the matcher defined by the group
     */
    where(param: string, matcher: RouteMatcher | string | RegExp): this;
    /**
     * Define prefix for the route. Calling this method multiple times
     * applies multiple prefixes in the reverse order.
     */
    prefix(prefix: string): this;
    /**
     * Define a custom domain for the route. We do not overwrite the domain
     * unless `overwrite` flag is set to true.
     */
    domain(domain: string, overwrite?: boolean): this;
    /**
     * Define one or more middleware to be executed before the route
     * handler.
     *
     * Named middleware can be referenced using the name registered with
     * the router middleware store.
     */
    use(middleware: OneOrMore<MiddlewareFn | ParsedNamedMiddleware>): this;
    /**
     * @alias use
     */
    middleware(middleware: OneOrMore<MiddlewareFn | ParsedNamedMiddleware>): this;
    /**
     * Give a unique name to the route. Assinging a new unique removes the
     * existing name of the route.
     *
     * Setting prepends to true prefixes the name to the existing name.
     */
    as(name: string, prepend?: boolean): this;
    /**
     * Check if the route was marked to be deleted
     */
    isDeleted(): boolean;
    /**
     * Mark route as deleted. Deleted routes are not registered
     * with the route store
     */
    markAsDeleted(): void;
    /**
     * Get the route name
     */
    getName(): string | undefined;
    /**
     * Get the route pattern
     */
    getPattern(): string;
    /**
     * Set the route pattern
     */
    setPattern(pattern: string): this;
    /**
     * Returns the stack of middleware registered on the route.
     * The value is shared by reference.
     */
    getMiddleware(): StoreRouteMiddleware[][];
    /**
     * Returns JSON representation of the route
     */
    toJSON(): RouteJSON;
}
