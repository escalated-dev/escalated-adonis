import type { AbstractConstructor, Constructor } from '@poppinss/utils/types';
import type { Container } from './container.js';
import type { BindingResolver, Make } from './types.js';
/**
 * A fluent builder to register contextual bindings with the
 * container.
 */
export declare class ContextBindingsBuilder<KnownBindings extends Record<any, any>, PinnedBinding extends AbstractConstructor<any>> {
    #private;
    constructor(parent: Constructor<any>, container: Container<KnownBindings>);
    /**
     * Specify the binding for which to register a custom
     * resolver.
     */
    asksFor<Binding extends PinnedBinding>(binding: Binding): ContextBindingsBuilder<KnownBindings, Binding>;
    /**
     * Provide a resolver to resolve the parent dependency
     */
    provide(resolver: BindingResolver<KnownBindings, Make<PinnedBinding>>): void;
}
