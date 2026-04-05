import { Knex } from 'knex';
import type { Emitter } from '@adonisjs/core/events';
import { IsolationLevels, DialectContract, ConnectionContract, QueryClientContract, TransactionClientContract } from '../types/database.js';
import { LucidModel, ModelQueryBuilderContract } from '../types/model.js';
import { RawQueryBindings, DatabaseQueryBuilderContract, InsertQueryBuilderContract, RawQueryBuilderContract, RawBuilderContract, ReferenceBuilderContract, ChainableContract, Dictionary, QueryCallback } from '../types/querybuilder.js';
/**
 * Query client exposes the API to fetch instance of different query builders
 * to perform queries on a selecte connection.
 */
export declare class QueryClient implements QueryClientContract {
    mode: 'dual' | 'write' | 'read';
    private connection;
    emitter: Emitter<any>;
    /**
     * Not a transaction client
     */
    readonly isTransaction = false;
    /**
     * The dialect in use
     */
    dialect: DialectContract;
    /**
     * Name of the connection in use
     */
    readonly connectionName: string;
    /**
     * Is debugging enabled
     */
    debug: boolean;
    constructor(mode: 'dual' | 'write' | 'read', connection: ConnectionContract, emitter: Emitter<any>);
    /**
     * Returns schema instance for the write client
     */
    get schema(): Knex.SchemaBuilder;
    /**
     * Returns the read client. The readClient is optional, since we can get
     * an instance of [[QueryClient]] with a sticky write client.
     */
    getReadClient(): Knex<any, any>;
    /**
     * Returns the write client
     */
    getWriteClient(): Knex<any, any>;
    /**
     * Truncate table
     */
    truncate(table: string, cascade?: boolean | undefined): Promise<void>;
    /**
     * Get information for a table columns
     */
    columnsInfo(table: string): Promise<{
        [column: string]: Knex.ColumnInfo;
    }>;
    columnsInfo(table: string, column: string): Promise<Knex.ColumnInfo>;
    /**
     * Returns an array of table names
     */
    getAllTables(schemas?: string[] | undefined): Promise<string[]>;
    /**
     * Returns an array of all views names
     */
    getAllViews(schemas?: string[] | undefined): Promise<string[]>;
    /**
     * Returns an array of all types names
     */
    getAllTypes(schemas?: string[] | undefined): Promise<string[]>;
    /**
     * Returns an array of all domain names
     */
    getAllDomains(schemas?: string[]): Promise<string[]>;
    /**
     * Drop all tables inside database
     */
    dropAllTables(schemas?: string[] | undefined): Promise<void>;
    /**
     * Drop all views inside the database
     */
    dropAllViews(schemas?: string[] | undefined): Promise<void>;
    /**
     * Drop all custom types inside the database
     */
    dropAllTypes(schemas?: string[] | undefined): Promise<void>;
    /**
     * Drop all custom domains inside the database
     */
    dropAllDomains(schemas?: string[]): Promise<void>;
    /**
     * Returns an instance of a transaction. Each transaction will
     * query and hold a single connection for all queries.
     */
    transaction<T>(callback: (trx: TransactionClientContract) => Promise<T>, options?: {
        isolationLevel?: IsolationLevels;
    }): Promise<T>;
    transaction(options?: {
        isolationLevel?: IsolationLevels;
    }): Promise<TransactionClientContract>;
    /**
     * Returns the knex query builder instance. The query builder is always
     * created from the `write` client, so before executing the query, you
     * may want to decide which client to use.
     */
    knexQuery(): Knex.QueryBuilder<any, any>;
    /**
     * Returns the knex raw query builder instance. The query builder is always
     * created from the `write` client, so before executing the query, you
     * may want to decide which client to use.
     */
    knexRawQuery(sql: string, bindings?: RawQueryBindings | undefined): Knex.Raw<any>;
    /**
     * Returns a query builder instance for a given model.
     */
    modelQuery<T extends LucidModel, Result = T>(model: T): ModelQueryBuilderContract<T, Result>;
    /**
     * Returns instance of a query builder for selecting, updating
     * or deleting rows
     */
    query<Result = any>(): DatabaseQueryBuilderContract<Result>;
    /**
     * Returns instance of a query builder for inserting rows
     */
    insertQuery<ReturnColumns = any>(): InsertQueryBuilderContract<ReturnColumns[]>;
    /**
     * Returns instance of raw query builder
     */
    rawQuery<Result = any>(sql: string, bindings?: RawQueryBindings | undefined): RawQueryBuilderContract<Result>;
    /**
     * Returns an instance of raw builder. This raw builder queries
     * cannot be executed. Use `rawQuery`, if you want to execute
     * queries raw queries.
     */
    raw(sql: string, bindings?: RawQueryBindings | undefined): RawBuilderContract;
    /**
     * Returns reference builder.
     */
    ref(reference: string): ReferenceBuilderContract;
    /**
     * Returns instance of a query builder and selects the table
     */
    from(table: string | Dictionary<string, string> | QueryCallback<DatabaseQueryBuilderContract> | ChainableContract): DatabaseQueryBuilderContract;
    /**
     * Returns instance of a query builder and selects the table
     * for an insert query
     */
    table<ReturnColumns = any>(table: string): InsertQueryBuilderContract<ReturnColumns[]>;
    /**
     * Get advisory lock on the selected connection
     */
    getAdvisoryLock(key: string | number, timeout?: number | undefined): Promise<boolean>;
    /**
     * Release advisory lock
     */
    releaseAdvisoryLock(key: string | number): Promise<boolean>;
}
