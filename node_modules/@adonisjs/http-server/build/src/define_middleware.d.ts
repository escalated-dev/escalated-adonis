import type { LazyImport, UnWrapLazyImport } from './types/base.js';
import type { GetMiddlewareArgs, MiddlewareAsClass, ParsedGlobalMiddleware } from './types/middleware.js';
/**
 * Define an collection of named middleware. The collection gets converted
 * into a collection of factory functions. Calling the function returns
 * a reference to the executable middleware.
 */
export declare function defineNamedMiddleware<NamedMiddleware extends Record<string | number | symbol, LazyImport<MiddlewareAsClass>>>(collection: NamedMiddleware): { [K in keyof NamedMiddleware]: <Args extends GetMiddlewareArgs<UnWrapLazyImport<NamedMiddleware[K]>>>(...args: Args) => {
    name: K;
    args: Args[0];
    handle: ParsedGlobalMiddleware["handle"];
}; };
