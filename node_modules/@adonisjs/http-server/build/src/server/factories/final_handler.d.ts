import type { ContainerResolver } from '@adonisjs/fold';
import type { Router } from '../../router/main.js';
import type { HttpContext } from '../../http_context/main.js';
import type { ServerErrorHandler } from '../../types/server.js';
/**
 * The final handler is executed after the server middleware stack.
 * It looks for a matching route and executes the route middleware
 * stack.
 */
export declare function finalHandler(router: Router, resolver: ContainerResolver<any>, ctx: HttpContext, errorResponder: ServerErrorHandler['handle']): () => any;
