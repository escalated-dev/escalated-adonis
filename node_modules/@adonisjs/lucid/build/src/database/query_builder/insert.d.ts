import { Knex } from 'knex';
import Macroable from '@poppinss/macroable';
import { InsertQueryBuilderContract } from '../../types/querybuilder.js';
import { QueryClientContract, TransactionClientContract } from '../../types/database.js';
/**
 * Exposes the API for performing SQL inserts
 */
export declare class InsertQueryBuilder extends Macroable implements InsertQueryBuilderContract {
    knexQuery: Knex.QueryBuilder;
    client: QueryClientContract;
    /**
     * Custom data someone want to send to the profiler and the
     * query event
     */
    private customReporterData;
    /**
     * Control whether to debug the query or not. The initial
     * value is inherited from the query client
     */
    private debugQueries;
    /**
     * Required by macroable
     */
    protected static macros: {};
    protected static getters: {};
    constructor(knexQuery: Knex.QueryBuilder, client: QueryClientContract);
    /**
     * Returns the log data
     */
    private getQueryData;
    /**
     * Transforms the value to something that knex can internally understand and
     * handle. It includes.
     *
     * 1. Returning the `knexBuilder` for sub queries.
     * 2. Returning the `knexBuilder` for raw queries.
     */
    protected transformValue(value: any): any;
    /**
     * Returns the underlying knex raw query builder for Lucid raw
     * query builder
     */
    protected transformRaw(value: any): any;
    /**
     * Define custom reporter data. It will be merged with
     * the existing data
     */
    reporterData(data: any): this;
    /**
     * Define table for performing the insert query
     */
    table(table: any): this;
    /**
     * Define schema for the table
     */
    withSchema(schema: any): this;
    /**
     * Define returning columns for the insert query
     */
    returning(column: any): any;
    /**
     * Perform insert query
     */
    insert(columns: any): this;
    /**
     * Insert multiple rows in a single query
     */
    multiInsert(columns: any): this;
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
     * Do not use this method. Instead create a query using the
     * transaction client directly.
     *
     * ```ts
     * trx.insertQuery()
     * ```
     */
    useTransaction(transaction: TransactionClientContract): this;
    /**
     * Executes the query
     */
    exec(): Promise<any>;
    /**
     * Get sql representation of the query
     */
    toSQL(): Knex.Sql;
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
    finally(fullfilled: any): Promise<any>;
    /**
     * Required when Promises are extended
     */
    get [Symbol.toStringTag](): string;
}
