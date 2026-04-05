import type { NextFn } from '@poppinss/middleware/types';
import type { ContainerResolver } from '@adonisjs/fold';
import type { HttpContext } from '../../http_context/main.js';
import { ParsedGlobalMiddleware } from '../../types/middleware.js';
/**
 * The middleware handler invokes the middleware functions.
 */
export declare function middlewareHandler(resolver: ContainerResolver<any>, ctx: HttpContext): (fn: ParsedGlobalMiddleware, next: NextFn) => any;
