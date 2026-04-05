/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { Exception } from '@poppinss/utils';
import { RawBuilder } from '../database/static_builder/raw.js';
import { clientsToDialectsMapping } from '../dialects/index.js';
import { TransactionClient } from '../transaction_client/index.js';
import { RawQueryBuilder } from '../database/query_builder/raw.js';
import { InsertQueryBuilder } from '../database/query_builder/insert.js';
import { ReferenceBuilder } from '../database/static_builder/reference.js';
import { DatabaseQueryBuilder } from '../database/query_builder/database.js';
import { ModelQueryBuilder } from '../orm/query_builder/index.js';
/**
 * Query client exposes the API to fetch instance of different query builders
 * to perform queries on a selecte connection.
 */
export class QueryClient {
    mode;
    connection;
    emitter;
    /**
     * Not a transaction client
     */
    isTransaction = false;
    /**
     * The dialect in use
     */
    dialect;
    /**
     * Name of the connection in use
     */
    connectionName;
    /**
     * Is debugging enabled
     */
    debug;
    constructor(mode, connection, emitter) {
        this.mode = mode;
        this.connection = connection;
        this.emitter = emitter;
        this.debug = !!this.connection.config.debug;
        this.connectionName = this.connection.name;
        this.dialect = new clientsToDialectsMapping[this.connection.clientName](this, this.connection.config);
    }
    /**
     * Returns schema instance for the write client
     */
    get schema() {
        return this.getWriteClient().schema;
    }
    /**
     * Returns the read client. The readClient is optional, since we can get
     * an instance of [[QueryClient]] with a sticky write client.
     */
    getReadClient() {
        if (this.mode === 'read' || this.mode === 'dual') {
            return this.connection.readClient;
        }
        return this.connection.client;
    }
    /**
     * Returns the write client
     */
    getWriteClient() {
        if (this.mode === 'write' || this.mode === 'dual') {
            return this.connection.client;
        }
        throw new Exception('Write client is not available for query client instantiated in read mode', {
            status: 500,
            code: 'E_RUNTIME_EXCEPTION',
        });
    }
    /**
     * Truncate table
     */
    async truncate(table, cascade) {
        await this.dialect.truncate(table, cascade);
    }
    async columnsInfo(table, column) {
        const query = this.getWriteClient().table(table);
        if (column) {
            query.columnInfo(column);
        }
        else {
            query.columnInfo();
        }
        const result = await query;
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
     * Returns an array of all domain names
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
     * Drop all custom domains inside the database
     */
    async dropAllDomains(schemas) {
        return this.dialect.dropAllDomains(schemas || ['public']);
    }
    async transaction(callback, options) {
        const trx = await this.getWriteClient().transaction(options);
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
     * Returns the knex query builder instance. The query builder is always
     * created from the `write` client, so before executing the query, you
     * may want to decide which client to use.
     */
    knexQuery() {
        return this.connection.client.queryBuilder();
    }
    /**
     * Returns the knex raw query builder instance. The query builder is always
     * created from the `write` client, so before executing the query, you
     * may want to decide which client to use.
     */
    knexRawQuery(sql, bindings) {
        return bindings ? this.connection.client.raw(sql, bindings) : this.connection.client.raw(sql);
    }
    /**
     * Returns a query builder instance for a given model.
     */
    modelQuery(model) {
        return new ModelQueryBuilder(this.knexQuery(), model, this);
    }
    /**
     * Returns instance of a query builder for selecting, updating
     * or deleting rows
     */
    query() {
        return new DatabaseQueryBuilder(this.knexQuery(), this);
    }
    /**
     * Returns instance of a query builder for inserting rows
     */
    insertQuery() {
        return new InsertQueryBuilder(this.getWriteClient().queryBuilder(), this);
    }
    /**
     * Returns instance of raw query builder
     */
    rawQuery(sql, bindings) {
        return new RawQueryBuilder(bindings ? this.connection.client.raw(sql, bindings) : this.connection.client.raw(sql), this);
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
        return new ReferenceBuilder(reference, this.getReadClient().client);
    }
    /**
     * Returns instance of a query builder and selects the table
     */
    from(table) {
        return this.query().from(table);
    }
    /**
     * Returns instance of a query builder and selects the table
     * for an insert query
     */
    table(table) {
        return this.insertQuery().table(table);
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
