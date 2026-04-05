import Macroable from '@poppinss/macroable';
import type { RouteMatcher } from '../types/route.js';
import type { MiddlewareFn, ParsedNamedMiddleware } from '../types/middleware.js';
import { Route } from './route.js';
import { BriskRoute } from './brisk.js';
import { RouteResource } from './resource.js';
import { OneOrMore } from '../types/base.js';
/**
 * Group class exposes the API to take action on a group of routes.
 * The group routes must be pre-defined using the constructor.
 */
export declare class RouteGroup extends Macroable {
    #private;
    routes: (Route | RouteGroup | RouteResource | BriskRoute)[];
    constructor(routes: (Route | RouteGroup | RouteResource | BriskRoute)[]);
    /**
     * Define route param matcher
     *
     * ```ts
     * Route.group(() => {
     * }).where('id', /^[0-9]+/)
     * ```
     */
    where(param: string, matcher: RouteMatcher | string | RegExp): this;
    /**
     * Define prefix all the routes in the group.
     *
     * ```ts
     * Route.group(() => {
     * }).prefix('v1')
     * ```
     */
    prefix(prefix: string): this;
    /**
     * Define domain for all the routes.
     *
     * ```ts
     * Route.group(() => {
     * }).domain(':name.adonisjs.com')
     * ```
     */
    domain(domain: string): this;
    /**
     * Prepend name to the routes name.
     *
     * ```ts
     * Route.group(() => {
     * }).as('version1')
     * ```
     */
    as(name: string): this;
    /**
     * Prepend an array of middleware to all routes middleware.
     *
     * ```ts
     * Route.group(() => {
     * }).use(middleware.auth())
     * ```
     */
    use(middleware: OneOrMore<MiddlewareFn | ParsedNamedMiddleware>): this;
    /**
     * @alias use
     */
    middleware(middleware: OneOrMore<MiddlewareFn | ParsedNamedMiddleware>): this;
}
