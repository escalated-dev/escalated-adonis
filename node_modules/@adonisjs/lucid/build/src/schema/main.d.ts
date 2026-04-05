import type { Knex } from 'knex';
import type { DeferCallback } from '../types/schema.js';
import type { QueryClientContract } from '../types/database.js';
import type { RawQueryBindings } from '../types/querybuilder.js';
/**
 * Exposes the API to define table schema using deferred database
 * calls.
 */
export declare class BaseSchema {
    db: QueryClientContract;
    file: string;
    dryRun: boolean;
    /**
     * All calls to `schema` and `defer` are tracked to be
     * executed later
     */
    private trackedCalls;
    /**
     * The state of the schema. It cannot be re-executed after completion
     */
    private state;
    /**
     * Enable/disable transactions for this schema
     */
    static disableTransactions: boolean;
    /**
     * Returns the schema to build database tables
     */
    get schema(): Knex.SchemaBuilder;
    /**
     * Control whether to debug the query or not. The initial
     * value is inherited from the query client
     */
    debug: boolean;
    constructor(db: QueryClientContract, file: string, dryRun?: boolean);
    /**
     * Returns schema queries sql without executing them
     */
    private getQueries;
    /**
     * Returns reporter instance
     */
    private getReporter;
    /**
     * Returns the log data
     */
    private getQueryData;
    /**
     * Executes schema queries and defer calls in sequence
     */
    private executeQueries;
    /**
     * Returns raw query for `now`
     */
    now(precision?: number): Knex.Raw<any>;
    /**
     * Instance of raw knex query builder
     */
    raw(sql: string, bindings?: RawQueryBindings): Knex.Raw;
    /**
     * Get access to the underlying knex query builder
     */
    knex(): Knex.QueryBuilder<any, any>;
    /**
     * Wrapping database calls inside defer ensures that they run
     * in the right order and also they won't be executed when
     * schema is invoked to return the SQL queries
     */
    defer(cb: DeferCallback): void;
    /**
     * Invokes schema `up` method. Returns an array of queries
     * when `dryRun` is set to true
     */
    execUp(): Promise<true | string[]>;
    /**
     * Invokes schema `down` method. Returns an array of queries
     * when `dryRun` is set to true
     */
    execDown(): Promise<true | string[]>;
    up(): Promise<void>;
    down(): Promise<void>;
}
