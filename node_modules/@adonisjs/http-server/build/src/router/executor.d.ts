import type { ContainerResolver } from '@adonisjs/fold';
import type { StoreRouteNode } from '../types/route.js';
import type { HttpContext } from '../http_context/main.js';
import type { ServerErrorHandler } from '../types/server.js';
/**
 * Executor to execute the route middleware pipeline the route
 * handler
 */
export declare function execute(route: StoreRouteNode, resolver: ContainerResolver<any>, ctx: HttpContext, errorResponder: ServerErrorHandler['handle']): Promise<void>;
