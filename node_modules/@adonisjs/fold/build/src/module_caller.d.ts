import type { Constructor } from '@poppinss/utils/types';
import { type Container } from './container.js';
import { type ContainerResolver } from './resolver.js';
import type { ModuleHandler, ModuleCallable } from './types.js';
/**
 * The moduleCaller works around a very specific pattern we use with
 * AdonisJS, ie to construct classes and call methods using the
 * container.
 *
 * For example: Controllers of AdonisJS allows defining a controller
 * as follows
 *
 * ```ts
 * route.get('/', [HomeController, 'index'])
 * ```
 *
 * Behind the scenes, we have to run following operations in order to call the
 * handle method on the defined middleware.
 *
 * - Create an instance of the controller class using the container.
 * - Call the method using the container. Hence having the ability to use
 *   DI
 */
export declare function moduleCaller(target: Constructor<any>, method: string): {
    /**
     * Converts the class reference to a callable function. Invoking this method
     * internally creates a new instance of the class using the container and
     * invokes the method using the container.
     *
     * You can create a callable function using the container instance as shown below
     *
     * ```ts
     * const fn = moduleCaller(HomeController, 'handle')
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
     * const fn = moduleCaller(HomeController, 'handle')
     *  .toCallable()
     *
     * // Call the function and pass context to it
     * const resolver = container.createResolver()
     * await fn(resolver, ctx)
     * ```
     */
    toCallable<T extends Container<any> | ContainerResolver<any> | undefined = undefined, Args extends any[] = any[]>(container?: T): ModuleCallable<T, Args>;
    /**
     * Converts the class reference to an object with handle method. Invoking this
     * method internally creates a new instance of the class using the container
     * and invokes the method using the container.
     *
     * You can create a handle method object using the container instance as shown below
     *
     * ```ts
     * const handler = moduleCaller(HomeController, 'handle')
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
     * const handler = moduleCaller(HomeController, 'handle')
     *  .toHandleMethod()
     *
     * // Call the function and pass context to it
     * const resolver = container.createResolver()
     * await handler.handle(resolver, ctx)
     * ```
     */
    toHandleMethod<T extends Container<any> | ContainerResolver<any> | undefined = undefined, Args extends any[] = any[]>(container?: T): ModuleHandler<T, Args>;
};
