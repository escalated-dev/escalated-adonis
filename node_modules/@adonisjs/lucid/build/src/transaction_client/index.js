/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import Hooks from '@poppinss/hooks';
import { EventEmitter } from 'node:events';
import { ModelQueryBuilder } from '../orm/query_builder/index.js';
import { RawBuilder } from '../database/static_builder/raw.js';
import { RawQueryBuilder } from '../database/query_builder/raw.js';
import { InsertQueryBuilder } from '../database/query_builder/insert.js';
import { ReferenceBuilder } from '../database/static_builder/reference.js';
import { DatabaseQueryBuilder } from '../database/query_builder/database.js';
/**
 * Transaction uses a dedicated connection from the connection pool
 * and executes queries inside a given transaction.
 */
export class TransactionClient extends EventEmitter {
    knexClient;
    dialect;
    connectionName;
    debug;
    emitter;
    /**
     * Always true
     */
    isTransaction = true;
    /**
     * Transactions are always in write mode, since they always needs
     * the primary connection
     */
    mode = 'dual';
    hooks = new Hooks();
    constructor(knexClient, dialect, connectionName, debug, emitter) {
        super();
        this.knexClient = knexClient;
        this.dialect = dialect;
        this.connectionName = connectionName;
        this.debug = debug;
        this.emitter = emitter;
        /**
         * Lucid models listens for transaction events to delete the reference. During
         * testing, it is common to generate more than 10 model instances and hence
         * the max listeners limit needs to be removed
         */
        this.setMaxListeners(Number.POSITIVE_INFINITY);
    }
    /**
     * Whether or not transaction has been completed
     */
    get isCompleted() {
        return this.knexClient.isCompleted();
    }
    /**
     * Returns schema instance for the write client
     */
    get schema() {
        return this.getWriteClient().schema;
    }
    /**
     * Returns the read client. Which is just a single client in case
     * of transactions
     */
    getReadClient() {
        return this.knexClient;
    }
    /**
     * Returns the write client. Which is just a single client in case
     * of transactions
     */
    getWriteClient() {
        return this.knexClient;
    }
    /**
     * Truncate tables inside a transaction
     */
    async truncate(table, cascade = false) {
        await this.dialect.truncate(table, cascade);
    }
    /**
     * Get columns info inside a transaction. You won't need it here, however
     * added for API compatibility with the [[QueryClient]] class
     */
    async columnsInfo(table, column) {
        const query = this.knexClient.select(table);
        const result = await (column ? query.columnInfo(column) : query.columnInfo());
        return result;
    }
    /**
     * Returns an array of table names
     */
    async getAllTables(schemas) {
        return this.dialect.getAllTables(schemas);
    }
    /**
     * Returns an array of all views names
     */
    async getAllViews(schemas) {
        return this.dialect.getAllViews(schemas);
    }
    /**
     * Returns an array of all types names
     */
    async getAllTypes(schemas) {
        return this.dialect.getAllTypes(schemas);
    }
    /**
     * Returns an array of all domains names
     */
    async getAllDomains(schemas) {
        return this.dialect.getAllDomains(schemas);
    }
    /**
     * Drop all tables inside database
     */
    async dropAllTables(schemas) {
        return this.dialect.dropAllTables(schemas || ['public']);
    }
    /**
     * Drop all views inside the database
     */
    async dropAllViews(schemas) {
        return this.dialect.dropAllViews(schemas || ['public']);
    }
    /**
     * Drop all custom types inside the database
     */
    async dropAllTypes(schemas) {
        return this.dialect.dropAllTypes(schemas || ['public']);
    }
    /**
     * Drop all domains inside the database
     */
    async dropAllDomains(schemas) {
        return this.dialect.dropAllDomains(schemas || ['public']);
    }
    /**
     * Get a new query builder instance
     */
    knexQuery() {
        return this.knexClient.queryBuilder();
    }
    /**
     * Returns the knex raw query builder instance. The query builder is always
     * created from the `write` client, so before executing the query, you
     * may want to decide which client to use.
     */
    knexRawQuery(sql, bindings) {
        return bindings ? this.knexClient.raw(sql, bindings) : this.knexClient.raw(sql);
    }
    /**
     * Returns a query builder instance for a given model. The `connection`
     * and `profiler` is passed down to the model, so that it continue
     * using the same options
     */
    modelQuery(model) {
        return new ModelQueryBuilder(this.knexQuery(), model, this);
    }
    /**
     * Get a new query builder instance
     */
    query() {
        return new DatabaseQueryBuilder(this.knexQuery(), this);
    }
    /**
     * Get a new insert query builder instance
     */
    insertQuery() {
        return new InsertQueryBuilder(this.knexQuery(), this);
    }
    /**
     * Execute raw query on transaction
     */
    rawQuery(sql, bindings) {
        return new RawQueryBuilder(this.knexClient.raw(sql, bindings), this);
    }
    /**
     * Returns an instance of raw builder. This raw builder queries
     * cannot be executed. Use `rawQuery`, if you want to execute
     * queries raw queries.
     */
    raw(sql, bindings) {
        return new RawBuilder(sql, bindings);
    }
    /**
     * Returns reference builder.
     */
    ref(reference) {
        return new ReferenceBuilder(reference, this.knexClient.client);
    }
    /**
     * Returns another instance of transaction with save point
     */
    async transaction(callback, options) {
        const trx = await this.knexClient.transaction(options);
        const transaction = new TransactionClient(trx, this.dialect, this.connectionName, this.debug, this.emitter);
        /**
         * Self managed transaction
         */
        if (typeof callback === 'function') {
            try {
                const response = await callback(transaction);
                !transaction.isCompleted && (await transaction.commit());
                return response;
            }
            catch (error) {
                await transaction.rollback();
                throw error;
            }
        }
        return transaction;
    }
    /**
     * Same as [[Transaction.query]] but also selects the table
     */
    from(table) {
        return this.query().from(table);
    }
    /**
     * Same as [[Transaction.insertTable]] but also selects the table
     */
    table(table) {
        return this.insertQuery().table(table);
    }
    /**
     * Register after commit or rollback hook
     */
    after(event, handler) {
        this.hooks.add(`after:${event}`, handler);
        return this;
    }
    /**
     * Commit the transaction
     */
    async commit() {
        try {
            await this.knexClient.commit();
            this.emit('commit', this);
            this.removeAllListeners();
        }
        catch (error) {
            this.removeAllListeners();
            throw error;
        }
        try {
            await this.hooks.runner('after:commit').run();
            this.hooks.clear('after:commit');
        }
        catch { }
    }
    /**
     * Rollback the transaction
     */
    async rollback() {
        try {
            await this.knexClient.rollback();
            this.emit('rollback', this);
            this.removeAllListeners();
        }
        catch (error) {
            this.removeAllListeners();
            throw error;
        }
        try {
            await this.hooks.runner('after:rollback').run();
            this.hooks.clear('after:rollback');
        }
        catch { }
    }
    /**
     * Get advisory lock on the selected connection
     */
    getAdvisoryLock(key, timeout) {
        return this.dialect.getAdvisoryLock(key, timeout);
    }
    /**
     * Release advisory lock
     */
    releaseAdvisoryLock(key) {
        return this.dialect.releaseAdvisoryLock(key);
    }
}
