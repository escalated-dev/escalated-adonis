import Hooks from '@poppinss/hooks';
import { LucidModel } from '../types/model.js';
import { ExtractModelRelations } from '../types/relations.js';
import { EventsList, HooksHandler, StateCallback, MergeCallback, NewUpCallback, DefineCallback, FactoryModelContract, FactoryRelationContract } from '../types/factory.js';
import { FactoryManager } from './main.js';
/**
 * Factory model exposes the API to define a model factory with custom
 * states and relationships
 */
export declare class FactoryModel<Model extends LucidModel> implements FactoryModelContract<Model> {
    model: Model;
    define: DefineCallback<Model>;
    manager: FactoryManager;
    /**
     * Method to instantiate a new model instance. This method can be
     * overridden using the `newUp` public method.
     */
    newUpModelInstance: NewUpCallback<LucidModel, FactoryModelContract<LucidModel>>;
    /**
     * Method to merge runtime attributes with the model instance. This method
     * can be overridden using the `merge` method.
     */
    mergeAttributes: MergeCallback<LucidModel, FactoryModelContract<LucidModel>>;
    /**
     * A collection of factory states
     */
    states: {
        [key: string]: StateCallback<Model>;
    };
    /**
     * A collection of factory relations
     */
    relations: {
        [relation: string]: FactoryRelationContract;
    };
    /**
     * A set of registered hooks
     */
    hooks: Hooks<Record<string, [any[], any[]]>>;
    constructor(model: Model, define: DefineCallback<Model>, manager: FactoryManager);
    /**
     * Register a before event hook
     */
    before(event: 'makeStubbed' | 'create', handler: HooksHandler<Model, this>): this;
    /**
     * Register an after event hook
     */
    after(event: EventsList, handler: HooksHandler<Model, this>): this;
    /**
     * Returns state callback defined on the model factory. Raises an
     * exception, when state is not registered
     */
    getState(state: string): StateCallback<Model>;
    /**
     * Returns the pre-registered relationship factory function, along with
     * the original model relation.
     */
    getRelation(relation: keyof this['relations']): FactoryRelationContract;
    /**
     * Define custom state for the factory. When executing the factory,
     * you can apply the pre-defined states
     */
    state<K extends string>(state: K, callback: StateCallback<Model>): this & {
        states: {
            [P in K]: StateCallback<Model>;
        };
    };
    /**
     * Define a relationship on another factory
     */
    relation<K extends ExtractModelRelations<InstanceType<Model>>, Relation>(relation: K, callback: Relation): this & {
        relations: {
            [P in K]: Relation;
        };
    };
    /**
     * Define a custom `newUp` method
     */
    newUp(callback: NewUpCallback<any, any>): this;
    /**
     * Define a custom `merge` method
     */
    merge(callback: MergeCallback<any, any>): this;
    /**
     * Build factory model and return factory builder. The builder is then
     * used to make/create model instances
     */
    build(): any;
}
