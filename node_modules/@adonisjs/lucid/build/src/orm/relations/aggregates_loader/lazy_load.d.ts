import { LucidRow, LazyLoadAggregatesContract } from '../../../types/model.js';
/**
 * An implementation for lazy loading model relationship aggregates
 */
export declare class LazyLoadAggregates<Model extends LucidRow> implements LazyLoadAggregatesContract<Model> {
    private model;
    private query;
    constructor(model: Model);
    /**
     * Load aggregate of relationship
     */
    loadAggregate(relationName: any, userCallback?: any): this;
    /**
     * Load count of relationship
     */
    loadCount(relationName: any, userCallback?: any): this;
    /**
     * Execute query
     */
    exec(): Promise<void>;
    /**
     * Implementation of `then` for the promise API
     */
    then(resolve: any, reject?: any): any;
    /**
     * Implementation of `catch` for the promise API
     */
    catch(reject: any): any;
    /**
     * Implementation of `finally` for the promise API
     */
    finally(fullfilled: any): Promise<void>;
    /**
     * Required when Promises are extended
     */
    get [Symbol.toStringTag](): string;
}
