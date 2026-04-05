import { QueryClientContract } from '../types/database.js';
import { LucidRow, LucidModel, ModelAdapterOptions, ModelObject } from '../types/model.js';
import { FactoryModelContract, FactoryContextContract, FactoryBuilderContract, FactoryRelationContract } from '../types/factory.js';
import { FactoryModel } from './factory_model.js';
/**
 * Factory builder exposes the API to create/persist factory model instances.
 */
export declare class FactoryBuilder implements FactoryBuilderContract<LucidModel, FactoryModelContract<LucidModel>> {
    factory: FactoryModel<LucidModel>;
    private options?;
    /**
     * The relationship via which this factory builder was
     * created
     */ private viaRelation?;
    /**
     * Relationships to setup. Do note: It is possible to load one relationship
     * twice. A practical use case is to apply different states. For example:
     *
     * Make user with "3 active posts" and "2 draft posts"
     */
    private withRelations;
    /**
     * An array of callbacks to execute before persisting the model instance
     */
    private tapCallbacks;
    /**
     * Belongs to relationships are treated different, since they are
     * persisted before the parent model
     */
    private withBelongsToRelations;
    /**
     * The current index. Updated by `makeMany` and `createMany`
     */
    private currentIndex;
    /**
     * Custom attributes to pass to model merge method
     */
    private attributes;
    /**
     * Custom attributes to pass to relationship merge methods
     */
    private recursiveAttributes;
    /**
     * States to apply. One state can be applied only once and hence
     * a set is used.
     */
    private appliedStates;
    /**
     * Custom context passed using `useCtx` method. It not defined, we will
     * create one inline inside `create` and `make` methods
     */
    private ctx?;
    /**
     * Pivot attributes for a many to many relationship
     */
    private attributesForPivotTable?;
    /**
     * Instead of relying on the `FactoryModelContract`, we rely on the
     * `FactoryModel`, since it exposes certain API's required for
     * the runtime operations and those API's are not exposed
     * on the interface to keep the API clean
     */
    constructor(factory: FactoryModel<LucidModel>, options?: ModelAdapterOptions | undefined, 
    /**
     * The relationship via which this factory builder was
     * created
     */ viaRelation?: FactoryRelationContract | undefined);
    /**
     * Access the parent relationship for which the model instance
     * is created
     */
    get parent(): LucidRow | undefined;
    /**
     * Returns factory state
     */
    private getCtx;
    /**
     * Returns attributes to merge for a given index
     */
    private getMergeAttributes;
    /**
     * Returns a new model instance with filled attributes
     */
    private getModelInstance;
    /**
     * Apply states by invoking state callback
     */
    private applyStates;
    /**
     * Invoke tap callbacks
     */
    private invokeTapCallback;
    /**
     * Compile factory by instantiating model instance, applying merge
     * attributes, apply state
     */
    private compile;
    /**
     * Makes relationship instances. Call [[createRelation]] to
     * also persist them.
     */
    private makeRelations;
    /**
     * Makes and persists relationship instances
     */
    private createRelations;
    /**
     * Persist the model instance along with its relationships
     */
    private persistModelInstance;
    /**
     * Define custom database connection
     */
    connection(connection: string): this;
    /**
     * Define custom query client
     */
    client(client: QueryClientContract): this;
    /**
     * Define custom context. Usually called by the relationships
     * to share the parent context with relationship factory
     */
    useCtx(ctx: FactoryContextContract): this;
    /**
     * Load relationship
     */
    with(name: string, count?: number, callback?: (factory: never) => void): this;
    /**
     * Apply one or more states. Multiple calls to apply a single
     * state will be ignored
     */
    apply(...states: string[]): this;
    /**
     * Fill custom set of attributes. They are passed down to the newUp
     * method of the factory
     */
    merge(attributes: any): this;
    /**
     * Merge custom set of attributes with the correct factory builder
     * model and all of its relationships as well
     */
    mergeRecursive(attributes: any): this;
    /**
     * Define pivot attributes when persisting a many to many
     * relationship. Results in a noop, when not called
     * for a many to many relationship
     */
    pivotAttributes(attributes: ModelObject | ModelObject[]): this;
    /**
     * Tap into the persistence layer of factory builder. Allows one
     * to modify the model instance just before it is persisted
     * to the database
     */
    tap(callback: (row: LucidRow, state: FactoryContextContract, builder: this) => void): this;
    /**
     * Make model instance. Relationships are not processed with the make function.
     */
    make(): Promise<LucidRow>;
    /**
     * Create many of the factory model instances
     */
    makeMany(count: number): Promise<LucidRow[]>;
    /**
     * Returns a model instance without persisting it to the database.
     * Relationships are still loaded and states are also applied.
     */
    makeStubbed(): Promise<LucidRow>;
    /**
     * Create many of model factory instances
     */
    makeStubbedMany(count: number): Promise<LucidRow[]>;
    /**
     * Similar to make, but also persists the model instance to the
     * database.
     */
    create(): Promise<LucidRow>;
    /**
     * Create and persist many of factory model instances
     */
    createMany(count: number): Promise<LucidRow[]>;
}
