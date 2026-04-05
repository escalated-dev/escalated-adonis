import type { RouteJSON } from '../../types/route.js';
/**
 * Route finder is used to find a route by its name, route pattern
 * or the controller.method name.
 */
export declare class RouteFinder {
    #private;
    register(route: RouteJSON): void;
    /**
     * Find a route by indentifier
     */
    find(routeIdentifier: string): RouteJSON | null;
    /**
     * Find a route by indentifier or fail
     */
    findOrFail(routeIdentifier: string): RouteJSON;
    /**
     * Find if a route exists
     */
    has(routeIdentifier: string): boolean;
    /**
     * Returns an array of registered routes
     */
    toJSON(): RouteJSON[];
}
