import { Route } from './router/route.js';
import { BriskRoute } from './router/brisk.js';
import { RouteGroup } from './router/group.js';
import type { RouteJSON } from './types/route.js';
import { RouteResource } from './router/resource.js';
/**
 * Makes input string consistent by having only the starting
 * slash
 */
export declare function dropSlash(input: string): string;
/**
 * Returns a flat list of routes from the route groups and resources
 */
export declare function toRoutesJSON(routes: (RouteGroup | Route | RouteResource | BriskRoute)[]): RouteJSON[];
/**
 * Helper to know if the remote address should
 * be trusted.
 */
export declare function trustProxy(remoteAddress: string, proxyFn: (addr: string, distance: number) => boolean): boolean;
/**
 * Parses a range expression to an object filled with the range
 */
export declare function parseRange<T>(range: string, value: T): Record<number, T>;
