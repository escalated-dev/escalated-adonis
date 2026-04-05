import type { AbstractConstructor, Constructor, ExtractFunctions } from '@poppinss/utils/types';
import type { Make, BindingKey, ErrorCreator, HookCallback, BindingResolver, ContainerOptions } from './types.js';
import { ContainerResolver } from './resolver.js';
import { ContextBindingsBuilder } from './contextual_bindings_builder.js';
/**
 * The container class exposes the API to register bindings, values
 * and resolve them.
 *
 * Known bindings types can be defined at the time of the constructing
 * the container.
 *
 * ```ts
 * new Container<{ 'route': Route, encryption: Encryption }>()
 * ```
 *
 * You can resolve bindings and construct classes as follows
 *
 * ```ts
 * await container.make(BINDING_NAME)
 * await container.make(CLASS_CONSTRUCTOR)
 * ```
 */
export declare class Container<KnownBindings extends Record<any, any>> {
    #private;
    constructor(options?: ContainerOptions);
    /**
     * Define an emitter instance to use
     */
    useEmitter(emitter: Exclude<ContainerOptions['emitter'], undefined>): this;
    /**
     * Create a container resolver to resolve bindings, or make classes.
     *
     * ```ts
     * const resolver = container.createResolver()
     * await resolver.make(CLASS_CONSTRUCTOR)
     * ```
     *
     * Bind values with the resolver. Resolver values are isolated from the
     * container.
     *
     * ```ts
     * resolver.bindValue(HttpContext, new HttpContext())
     * await resolver.make(UsersController)
     * ```
     */
    createResolver(): ContainerResolver<KnownBindings>;
    /**
     * Find if the container has a binding registered using the
     * "bind", the "singleton", or the "bindValue" methods.
     */
    hasBinding<Binding extends keyof KnownBindings>(binding: Binding): boolean;
    hasBinding(binding: BindingKey): boolean;
    /**
     * Find if the container has all the bindings registered using the
     * "bind", the "singleton", or the "bindValue" methods.
     */
    hasAllBindings<Binding extends keyof KnownBindings>(bindings: Binding[]): boolean;
    hasAllBindings(binding: BindingKey[]): boolean;
    /**
     * Resolves the binding or constructor a class instance as follows.
     *
     * - Resolve the binding from the values (if registered)
     * - Resolve the binding from the bindings (if registered)
     * - If binding is a class, then create a instance of it. The constructor
     *   dependencies are further resolved as well.
     * - All other values are returned as it is.
     *
     * ```ts
     * await container.make('route')
     * await container.make(Database)
     * ```
     */
    make<Binding extends keyof KnownBindings>(binding: Binding, runtimeValues?: any[], createError?: ErrorCreator): Promise<Binding extends string | symbol ? KnownBindings[Binding] : Make<Binding>>;
    make<Binding>(binding: Binding, runtimeValues?: any[], createError?: ErrorCreator): Promise<Make<Binding>>;
    /**
     * Call a method on an object by injecting its dependencies. The method
     * dependencies are resolved in the same manner as a class constructor
     * dependencies.
     *
     * ```ts
     * await container.call(await container.make(UsersController), 'index')
     * ```
     */
    call<Value extends Record<any, any>, Method extends ExtractFunctions<Value>>(value: Value, method: Method, runtimeValues?: any[], createError?: ErrorCreator): Promise<ReturnType<Value[Method]>>;
    /**
     * Register an alias for a binding. The value can be a reference
     * to an existing binding or to a class constructor that will
     * instantiate to the same value as the alias.
     */
    alias<Alias extends keyof KnownBindings>(
    /**
     * An alias must always be defined as a string or a symbol. Classes cannot be
     * aliases
     */
    alias: Alias extends string | symbol ? Alias : never, 
    /**
     * The value should either be the constructor point to the alias value
     * or reference to binding that has the same value as the alias
     */
    value: AbstractConstructor<KnownBindings[Alias]> | Exclude<{
        [K in keyof KnownBindings]: KnownBindings[K] extends KnownBindings[Alias] ? K : never;
    }[keyof KnownBindings], Alias>): void;
    /**
     * Register a binding inside the container. The method receives a
     * key-value pair.
     *
     * - Key can be a string, symbol or a constructor.
     * - The value is always a factory function to construct the dependency.
     *
     * ```ts
     * container.bind('route', () => new Route())
     * await container.make('route')
     *
     * container.bind(Route, () => new Route())
     * await container.make(Route)
     *
     * const routeSymbol = Symbol('route')
     * container.bind(routeSymbol, () => new Route())
     * await container.make(routeSymbol)
     * ```
     */
    bind<Binding extends keyof KnownBindings>(
    /**
     * Need to narrow down the "Binding" for the case where "KnownBindings" are <any, any>
     */
    binding: Binding extends string | symbol ? Binding : never, resolver: BindingResolver<KnownBindings, KnownBindings[Binding]>): void;
    bind<Binding extends AbstractConstructor<any>>(binding: Binding, resolver: BindingResolver<KnownBindings, InstanceType<Binding>>): void;
    /**
     * Register a binding as a value
     *
     * ```ts
     * container.bindValue(Route, new Route())
     * ```
     */
    bindValue<Binding extends keyof KnownBindings>(
    /**
     * Need to narrow down the "Binding" for the case where "KnownBindings" are <any, any>
     */
    binding: Binding extends string | symbol ? Binding : never, value: KnownBindings[Binding]): void;
    bindValue<Binding extends AbstractConstructor<any>>(binding: Binding, value: InstanceType<Binding>): void;
    /**
     * Register a binding as a single. The singleton method is same
     * as the bind method, but the factory function is invoked
     * only once.
     *
     * ```ts
     * container.singleton('route', () => new Route())
     * await container.make('route')
     *
     * container.singleton(Route, () => new Route())
     * await container.make(Route)
     *
     * const routeSymbol = Symbol('route')
     * container.singleton(routeSymbol, () => new Route())
     * await container.make(routeSymbol)
     * ```
     */
    singleton<Binding extends keyof KnownBindings>(
    /**
     * Need to narrow down the "Binding" for the case where "KnownBindings" are <any, any>
     */
    binding: Binding extends string | symbol ? Binding : never, resolver: BindingResolver<KnownBindings, KnownBindings[Binding]>): void;
    singleton<Binding extends AbstractConstructor<any>>(binding: Binding, resolver: BindingResolver<KnownBindings, InstanceType<Binding>>): void;
    /**
     * Define a fake implementation for a binding or a class constructor.
     * Fakes have the highest priority when resolving dependencies
     * from the container.
     */
    swap<Binding extends AbstractConstructor<any>>(binding: Binding, resolver: BindingResolver<KnownBindings, InstanceType<Binding>>): void;
    /**
     * Restore binding by removing its swap
     */
    restore(binding: AbstractConstructor<any>): void;
    /**
     * Restore mentioned or all bindings by removing
     * their swaps
     */
    restoreAll(bindings?: AbstractConstructor<any>[]): void;
    /**
     * Define hooks to be executed after a binding has been resolved
     * from the container.
     *
     * The hooks are executed for
     *
     * - Bindings
     * - Only once for singletons
     * - And class constructor
     *
     * In other words, the hooks are not executed for direct values registered
     * with the container
     */
    resolving<Binding extends keyof KnownBindings>(binding: Binding extends string | symbol ? Binding : never, callback: HookCallback<KnownBindings, KnownBindings[Binding]>): void;
    resolving<Binding extends AbstractConstructor<any>>(binding: Binding, callback: HookCallback<KnownBindings, InstanceType<Binding>>): void;
    /**
     * Create a contextual builder to define contextual bindings
     */
    when(parent: Constructor<any>): ContextBindingsBuilder<KnownBindings, AbstractConstructor<any>>;
    /**
     * Add a contextual binding for a given class constructor. A
     * contextual takes a parent, parent's dependency and a callback
     * to self resolve the dependency.
     *
     * For example:
     * - When "UsersController"
     * - Asks for "Hash class"
     * - Provide "Argon2" implementation
     */
    contextualBinding<Binding extends AbstractConstructor<any>>(parent: Constructor<any>, binding: Binding, resolver: BindingResolver<KnownBindings, Make<Binding>>): void;
}
