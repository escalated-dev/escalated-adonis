import { Knex } from 'knex';
import { EventEmitter } from 'node:events';
import type { Emitter } from '@adonisjs/core/events';
import { IsolationLevels, DialectContract, TransactionClientContract } from '../types/database.js';
import { RawBuilder } from '../database/static_builder/raw.js';
import { ReferenceBuilder } from '../database/static_builder/reference.js';
import { LucidModel, ModelQueryBuilderContract } from '../types/model.js';
/**
 * Transaction uses a dedicated connection from the connection pool
 * and executes queries inside a given transaction.
 */
export declare class TransactionClient extends EventEmitter implements TransactionClientContract {
    knexClient: Knex.Transaction;
    dialect: DialectContract;
    connectionName: string;
    debug: boolean;
    emitter: Emitter<any>;
    /**
     * Always true
     */
    isTransaction: true;
    /**
     * Transactions are always in write mode, since they always needs
     * the primary connection
     */
    mode: 'dual';
    private hooks;
    constructor(knexClient: Knex.Transaction, dialect: DialectContract, connectionName: string, debug: boolean, emitter: Emitter<any>);
    /**
     * Whether or not transaction has been completed
     */
    get isCompleted(): boolean;
    /**
     * Returns schema instance for the write client
     */
    get schema(): Knex.SchemaBuilder;
    /**
     * Returns the read client. Which is just a single client in case
     * of transactions
     */
    getReadClient(): Knex.Transaction<any, any[]>;
    /**
     * Returns the write client. Which is just a single client in case
     * of transactions
     */
    getWriteClient(): Knex.Transaction<any, any[]>;
    /**
     * Truncate tables inside a transaction
     */
    truncate(table: string, cascade?: boolean): Promise<void>;
    /**
     * Get columns info inside a transaction. You won't need it here, however
     * added for API compatibility with the [[QueryClient]] class
     */
    columnsInfo(table: string, column?: string): Promise<any>;
    /**
     * Returns an array of table names
     */
    getAllTables(schemas?: string[]): Promise<string[]>;
    /**
     * Returns an array of all views names
     */
    getAllViews(schemas?: string[]): Promise<string[]>;
    /**
     * Returns an array of all types names
     */
    getAllTypes(schemas?: string[]): Promise<string[]>;
    /**
     * Returns an array of all domains names
     */
    getAllDomains(schemas?: string[]): Promise<string[]>;
    /**
     * Drop all tables inside database
     */
    dropAllTables(schemas?: string[]): Promise<void>;
    /**
     * Drop all views inside the database
     */
    dropAllViews(schemas?: string[]): Promise<void>;
    /**
     * Drop all custom types inside the database
     */
    dropAllTypes(schemas?: string[]): Promise<void>;
    /**
     * Drop all domains inside the database
     */
    dropAllDomains(schemas?: string[]): Promise<void>;
    /**
     * Get a new query builder instance
     */
    knexQuery(): Knex.QueryBuilder;
    /**
     * Returns the knex raw query builder instance. The query builder is always
     * created from the `write` client, so before executing the query, you
     * may want to decide which client to use.
     */
    knexRawQuery(sql: string, bindings?: any): Knex.Raw;
    /**
     * Returns a query builder instance for a given model. The `connection`
     * and `profiler` is passed down to the model, so that it continue
     * using the same options
     */
    modelQuery<T extends LucidModel, Result = T>(model: T): ModelQueryBuilderContract<T, Result>;
    /**
     * Get a new query builder instance
     */
    query(): any;
    /**
     * Get a new insert query builder instance
     */
    insertQuery(): any;
    /**
     * Execute raw query on transaction
     */
    rawQuery(sql: any, bindings?: any): any;
    /**
     * Returns an instance of raw builder. This raw builder queries
     * cannot be executed. Use `rawQuery`, if you want to execute
     * queries raw queries.
     */
    raw(sql: string, bindings?: any): RawBuilder;
    /**
     * Returns reference builder.
     */
    ref(reference: string): ReferenceBuilder;
    /**
     * Returns another instance of transaction with save point
     */
    transaction(callback?: {
        isolationLevel?: IsolationLevels;
    } | ((trx: TransactionClientContract) => Promise<any>), options?: {
        isolationLevel?: IsolationLevels;
    }): Promise<any>;
    /**
     * Same as [[Transaction.query]] but also selects the table
     */
    from(table: any): any;
    /**
     * Same as [[Transaction.insertTable]] but also selects the table
     */
    table(table: any): any;
    /**
     * Register after commit or rollback hook
     */
    after(event: 'rollback' | 'commit', handler: () => void | Promise<void>): this;
    /**
     * Commit the transaction
     */
    commit(): Promise<void>;
    /**
     * Rollback the transaction
     */
    rollback(): Promise<void>;
    /**
     * Get advisory lock on the selected connection
     */
    getAdvisoryLock(key: string, timeout?: number): any;
    /**
     * Release advisory lock
     */
    releaseAdvisoryLock(key: string): any;
}
