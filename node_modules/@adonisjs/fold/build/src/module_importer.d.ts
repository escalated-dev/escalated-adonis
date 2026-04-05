import type { Constructor } from '@poppinss/utils/types';
import { type Container } from './container.js';
import { type ContainerResolver } from './resolver.js';
import type { ModuleHandler, ModuleCallable } from './types.js';
/**
 * The moduleImporter module works around a very specific pattern we use
 * with AdonisJS, ie to lazy load modules by wrapping import calls inside
 * a callback.
 *
 * For example: Middleware of AdonisJS allows registering middleware as an
 * array of import calls.
 *
 * ```ts
 * defineMiddleware([
 *   () => import('#middleware/silent_auth')
 * ])
 *
 * defineMiddleware({
 *   auth: () => import('#middleware/auth')
 * })
 * ```
 *
 * Behind the scenes, we have to run following operations in order to call the
 * handle method on the defined middleware.
 *
 * - Lazily call the registered callbacks to import the middleware.
 * - Check if the module has a default export.
 * - Create an instance of the default export class using the container.
 * - Call the `handle` method on the middleware class using the container.
 */
export declare function moduleImporter(importFn: () => Promise<{
    default: Constructor<any>;
}>, method: string): {
    /**
     * Converts the module import function to a callable function. Invoking this
     * method run internally import the module, create a new instance of the
     * default export class using the container and invokes the method using
     * the container.
     *
     * You can create a callable function using the container instance as shown below
     *
     * ```ts
     * const fn = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
     *  .toCallable(container)
     *
     * // Call the function and pass context to it
     * await fn(ctx)
     * ```
     *
     * Another option is to not pass the container at the time of creating
     * the callable function, but instead pass a resolver instance at
     * the time of calling the function
     *
     * ```ts
     * const fn = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
     *  .toCallable()
     *
     * // Call the function and pass context to it
     * const resolver = container.createResolver()
     * await fn(resolver, ctx)
     * ```
     */
    toCallable<T extends Container<any> | ContainerResolver<any> | undefined = undefined, Args extends any[] = any[]>(container?: T): ModuleCallable<T, Args>;
    /**
     * Converts the module import function to an object with handle method. Invoking the
     * handle method run internally imports the module, create a new instance of
     * the default export class using the container and invokes the method using
     * the container.
     *
     * You can create a handle method object using the container instance as shown below
     *
     * ```ts
     * const handler = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
     *  .toHandleMethod(container)
     *
     * // Call the function and pass context to it
     * await handler.handle(ctx)
     * ```
     *
     * Another option is to not pass the container at the time of creating
     * the handle method object, but instead pass a resolver instance at
     * the time of calling the function
     *
     * ```ts
     * const handler = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
     *  .toHandleMethod()
     *
     * // Call the function and pass context to it
     * const resolver = container.createResolver()
     * await handler.handle(resolver, ctx)
     * ```
     */
    toHandleMethod<T extends Container<any> | ContainerResolver<any> | undefined = undefined, Args extends any[] = any[]>(container?: T): ModuleHandler<T, Args>;
};
