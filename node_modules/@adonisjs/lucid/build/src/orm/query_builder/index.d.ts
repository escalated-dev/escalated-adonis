import { Knex } from 'knex';
import { LucidRow, LucidModel, ModelObject, ModelAdapterOptions, ModelQueryBuilderContract } from '../../types/model.js';
import { PreloaderContract, RelationshipsContract } from '../../types/relations.js';
import { DialectContract, QueryClientContract, TransactionClientContract } from '../../types/database.js';
import { DBQueryCallback, Dictionary, OneOrMany } from '../../types/querybuilder.js';
import { Chainable } from '../../database/query_builder/chainable.js';
/**
 * Database query builder exposes the API to construct and run queries for selecting,
 * updating and deleting records.
 */
export declare class ModelQueryBuilder extends Chainable implements ModelQueryBuilderContract<LucidModel, LucidRow> {
    model: LucidModel;
    client: QueryClientContract;
    /**
     * A copy of defined preloads on the model instance
     */
    protected preloader: PreloaderContract<LucidRow>;
    /**
     * A custom callback to transform each model row
     */
    protected rowTransformerCallback?: (row: LucidRow) => void;
    /**
     * Required by macroable
     */
    protected static macros: {};
    protected static getters: {};
    /**
     * A references to model scopes wrapper. It is lazily initialized
     * only when the `apply` method is invoked
     */
    private scopesWrapper;
    /**
     * Control whether to wrap adapter result to model
     * instances or not
     */
    protected wrapResultsToModelInstances: boolean;
    /**
     * Custom data someone want to send to the profiler and the
     * query event
     */
    protected customReporterData: any;
    /**
     * Control whether to debug the query or not. The initial
     * value is inherited from the query client
     */
    protected debugQueries: boolean;
    /**
     * Self join counter, increments with every "withCount"
     * "has" and "whereHas" queries.
     */
    private joinCounter;
    /**
     * Options that must be passed to all new model instances
     */
    clientOptions: ModelAdapterOptions;
    /**
     * Whether query is a sub-query for `.where` callback
     */
    isChildQuery: boolean;
    /**
     * Side-loaded attributes that will be passed to the model instances
     */
    sideloaded: ModelObject;
    constructor(builder: Knex.QueryBuilder, model: LucidModel, client: QueryClientContract, customFn?: DBQueryCallback);
    /**
     * Executes the current query
     */
    private execQuery;
    /**
     * Ensures that we are not executing `update` or `del` when using read only
     * client
     */
    private ensureCanPerformWrites;
    /**
     * Defines sub query for checking the existence of a relationship
     */
    private addWhereHas;
    /**
     * Returns the profiler action. Protected, since the class is extended
     * by relationships
     */
    protected getQueryData(): {
        connection: string;
        inTransaction: boolean;
        model: string;
    };
    /**
     * Returns the relationship instance from the model. An exception is
     * raised when relationship is missing
     */
    protected getRelationship(name: string): RelationshipsContract;
    /**
     * Define custom reporter data. It will be merged with
     * the existing data
     */
    reporterData(data: any): this;
    /**
     * Define a custom callback to transform rows
     */
    rowTransformer(callback: (row: LucidRow) => void): this;
    /**
     * Clone the current query builder
     */
    clone<ClonedResult = LucidRow>(): ModelQueryBuilderContract<LucidModel, ClonedResult>;
    /**
     * Define returning columns
     */
    returning(columns: any): this;
    /**
     * Define a query to constraint to be defined when condition is truthy
     */
    ifDialect(dialects: DialectContract['name'] | DialectContract['name'][], matchCallback: (query: this) => any, noMatchCallback?: (query: this) => any): this;
    /**
     * Define a query to constraint to be defined when condition is falsy
     */
    unlessDialect(dialects: DialectContract['name'] | DialectContract['name'][], matchCallback: (query: this) => any, noMatchCallback?: (query: this) => any): this;
    /**
     * Applies the query scopes on the current query builder
     * instance
     */
    withScopes(callback: (scopes: any) => void): this;
    /**
     * Applies the query scopes on the current query builder
     * instance
     */
    apply(callback: (scopes: any) => void): this;
    /**
     * Define a custom preloader instance for preloading relationships
     */
    usePreloader(preloader: PreloaderContract<LucidRow>): this;
    /**
     * Set side-loaded properties to be passed to the model instance
     */
    sideload(value: ModelObject, merge?: boolean): this;
    /**
     * Fetch and return first results from the results set. This method
     * will implicitly set a `limit` on the query
     */
    first(): Promise<any>;
    /**
     * Fetch and return first results from the results set. This method
     * will implicitly set a `limit` on the query
     */
    firstOrFail(): Promise<any>;
    /**
     * Load aggregate value as a sub-query for a relationship
     */
    withAggregate(relationName: any, userCallback: any): this;
    /**
     * Get count of a relationship alongside the main query results
     */
    withCount(relationName: any, userCallback?: any): this;
    /**
     * Add where constraint using the relationship
     */
    whereHas(relationName: any, callback: any, operator?: string, value?: any): this;
    /**
     * Add or where constraint using the relationship
     */
    orWhereHas(relationName: any, callback: any, operator?: string, value?: any): this;
    /**
     * Alias of [[whereHas]]
     */
    andWhereHas(relationName: any, callback: any, operator?: string, value?: any): this;
    /**
     * Add where not constraint using the relationship
     */
    whereDoesntHave(relationName: any, callback: any, operator?: string, value?: any): this;
    /**
     * Add or where not constraint using the relationship
     */
    orWhereDoesntHave(relationName: any, callback: any, operator?: string, value?: any): this;
    /**
     * Alias of [[whereDoesntHave]]
     */
    andWhereDoesntHave(relationName: any, callback: any, operator?: string, value?: any): this;
    /**
     * Add where constraint using the relationship
     */
    has(relationName: any, operator?: string, value?: any): this;
    /**
     * Add or where constraint using the relationship
     */
    orHas(relationName: any, operator?: string, value?: any): this;
    /**
     * Alias of [[has]]
     */
    andHas(relationName: any, operator?: string, value?: any): this;
    /**
     * Add where not constraint using the relationship
     */
    doesntHave(relationName: any, operator?: string, value?: any): this;
    /**
     * Add or where not constraint using the relationship
     */
    orDoesntHave(relationName: any, operator?: string, value?: any): this;
    /**
     * Alias of [[doesntHave]]
     */
    andDoesntHave(relationName: any, operator?: string, value?: any): this;
    /**
     * Define a relationship to be preloaded
     */
    preload(relationName: any, userCallback?: any): this;
    /**
     * Define a relationship to preload, but only if they are not
     * already preloaded
     */
    preloadOnce(relationName: any): this;
    /**
     * Perform update by incrementing value for a given column. Increments
     * can be clubbed with `update` as well
     */
    increment(column: any, counter?: any): any;
    /**
     * Perform update by decrementing value for a given column. Decrements
     * can be clubbed with `update` as well
     */
    decrement(column: any, counter?: any): any;
    /**
     * Perform update
     */
    update(values: Dictionary<any, string>, returning?: OneOrMany<string>): ModelQueryBuilderContract<LucidModel>;
    update(column: string, value: any, returning?: OneOrMany<string>): ModelQueryBuilderContract<LucidModel>;
    /**
     * Delete rows under the current query
     */
    del(): any;
    /**
     * Alias for [[del]]
     */
    delete(): any;
    /**
     * Turn on/off debugging for this query
     */
    debug(debug: boolean): this;
    /**
     * Define query timeout
     */
    timeout(time: number, options?: {
        cancel: boolean;
    }): this;
    /**
     * Returns SQL query as a string
     */
    toQuery(): string;
    /**
     * @deprecated
     * Do not use this method. Instead create a query with options.client
     *
     * ```ts
     * Model.query({ client: trx })
     * ```
     */
    useTransaction(transaction: TransactionClientContract): this;
    /**
     * Executes the query
     */
    exec(): Promise<any[]>;
    /**
     * Paginate through rows inside a given table
     */
    paginate(page: number, perPage?: number): Promise<any>;
    /**
     * Get sql representation of the query
     */
    toSQL(): Knex.Sql;
    /**
     * Get rows back as a plain javascript object and not an array
     * of model instances
     */
    pojo(): this;
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
    finally(fulfilled: any): Promise<any[]>;
    /**
     * Required when Promises are extended
     */
    get [Symbol.toStringTag](): string;
}
