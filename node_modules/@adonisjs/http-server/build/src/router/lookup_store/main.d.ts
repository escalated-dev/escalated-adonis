import Macroable from '@poppinss/macroable';
import type { Encryption } from '@adonisjs/encryption';
import type { Qs } from '../../qs.js';
import { UrlBuilder } from './url_builder.js';
import type { RouteJSON } from '../../types/route.js';
/**
 * Lookup store exposes the API to lookup routes and
 * make URLs for registered routes.
 */
export declare class LookupStore extends Macroable {
    #private;
    constructor(encryption: Encryption, qsParser: Qs);
    /**
     * Register route JSON payload
     */
    register(route: RouteJSON): void;
    /**
     * Returns an instance of the URL builder for making
     * route URIs
     */
    builder(): UrlBuilder;
    /**
     * Returns an instance of the URL builder for a specific
     * domain.
     */
    builderForDomain(domain: string): UrlBuilder;
    /**
     * Finds a route by its identifier. The identifier can be the
     * route name, controller.method name or the route pattern
     * itself.
     */
    find(routeIdentifier: string, domain?: string): RouteJSON | null;
    /**
     * Finds a route by its identifier. The identifier can be the
     * route name, controller.method name or the route pattern
     * itself.
     *
     * An error is raised when unable to find the route.
     */
    findOrFail(routeIdentifier: string, domain?: string): RouteJSON;
    /**
     * Check if a route exists. The identifier can be the
     * route name, controller.method name or the route pattern
     * itself.
     */
    has(routeIdentifier: string, domain?: string): boolean;
    toJSON(): Record<string, RouteJSON[]>;
}
