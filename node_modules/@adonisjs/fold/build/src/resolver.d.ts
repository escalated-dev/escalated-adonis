import type { AbstractConstructor, Constructor, ExtractFunctions } from '@poppinss/utils/types';
import type { Make, Hooks, Swaps, Bindings, BindingKey, ErrorCreator, BindingValues, ContainerOptions, ContextualBindings } from './types.js';
/**
 * Container resolver exposes the APIs to resolve bindings. You can think
 * of resolver as an isolated container instance, with only the APIs
 * to resolve bindings.
 *
 * ```ts
 * const container = new Container()
 * const resolver = container.createResolver()
 *
 * await resolver.make(BINDING_NAME)
 * await resolver.make(CLASS_CONSTRUCTOR)
 * ```
 */
export declare class ContainerResolver<KnownBindings extends Record<any, any>> {
    #private;
    constructor(container: {
        bindings: Bindings;
        bindingValues: BindingValues;
        swaps: Swaps;
        hooks: Hooks;
        aliases: Map<Partial<keyof KnownBindings>, keyof KnownBindings | AbstractConstructor<any>>;
        contextualBindings: Map<Constructor<any>, ContextualBindings>;
    }, options: ContainerOptions);
    /**
     * Find if the resolver has a binding registered using the
     * "bind", the "singleton", or the "bindValue" methods.
     */
    hasBinding<Binding extends keyof KnownBindings>(binding: Binding): boolean;
    hasBinding(binding: BindingKey): boolean;
    /**
     * Find if the resolver has all the bindings registered using the
     * "bind", the "singleton", or the "bindValue" methods.
     */
    hasAllBindings<Binding extends keyof KnownBindings>(bindings: Binding[]): boolean;
    hasAllBindings(bindings: BindingKey[]): boolean;
    /**
     * Resolves binding in context of a parent. The method is same as
     * the "make" method, but instead takes a parent class
     * constructor.
     */
    resolveFor<Binding>(parent: unknown, binding: Binding, runtimeValues?: any[], createError?: ErrorCreator): Promise<Make<Binding>>;
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
     * await resolver.make('route')
     * await resolver.make(Database)
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
     * await resolver.call(await resolver.make(UsersController), 'index')
     * ```
     */
    call<Value extends Record<any, any>, Method extends ExtractFunctions<Value>>(value: Value, method: Method, runtimeValues?: any[], createError?: ErrorCreator): Promise<ReturnType<Value[Method]>>;
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
}
