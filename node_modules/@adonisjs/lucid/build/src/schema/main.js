/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { Exception } from '@poppinss/utils';
import { getDDLMethod } from '../utils/index.js';
import { QueryReporter } from '../query_reporter/index.js';
/**
 * Exposes the API to define table schema using deferred database
 * calls.
 */
export class BaseSchema {
    db;
    file;
    dryRun;
    /**
     * All calls to `schema` and `defer` are tracked to be
     * executed later
     */
    trackedCalls = [];
    /**
     * The state of the schema. It cannot be re-executed after completion
     */
    state = 'pending';
    /**
     * Enable/disable transactions for this schema
     */
    static disableTransactions = false;
    /**
     * Returns the schema to build database tables
     */
    get schema() {
        const schema = this.db.schema;
        this.trackedCalls.push(schema);
        return schema;
    }
    /**
     * Control whether to debug the query or not. The initial
     * value is inherited from the query client
     */
    debug;
    constructor(db, file, dryRun = false) {
        this.db = db;
        this.file = file;
        this.dryRun = dryRun;
        this.debug = this.db.debug;
    }
    /**
     * Returns schema queries sql without executing them
     */
    getQueries() {
        return this.trackedCalls
            .filter((schema) => typeof schema['toQuery'] === 'function')
            .map((schema) => schema.toQuery());
    }
    /**
     * Returns reporter instance
     */
    getReporter() {
        return new QueryReporter(this.db, this.debug, {});
    }
    /**
     * Returns the log data
     */
    getQueryData(sql) {
        return {
            connection: this.db.connectionName,
            inTransaction: this.db.isTransaction,
            ddl: true,
            ...sql,
            method: getDDLMethod(sql.sql),
        };
    }
    /**
     * Executes schema queries and defer calls in sequence
     */
    async executeQueries() {
        for (let trackedCall of this.trackedCalls) {
            if (typeof trackedCall === 'function') {
                await trackedCall(this.db);
            }
            else {
                const reporter = this.getReporter();
                try {
                    ;
                    trackedCall['once']('query', (sql) => reporter.begin(this.getQueryData(sql)));
                    await trackedCall;
                    reporter.end();
                }
                catch (error) {
                    reporter.end(error);
                    throw error;
                }
            }
        }
    }
    /**
     * Returns raw query for `now`
     */
    now(precision) {
        return precision
            ? this.db.knexRawQuery(`CURRENT_TIMESTAMP(${precision})`)
            : this.db.knexRawQuery('CURRENT_TIMESTAMP');
    }
    /**
     * Instance of raw knex query builder
     */
    raw(sql, bindings) {
        return this.db.knexRawQuery(sql, bindings);
    }
    /**
     * Get access to the underlying knex query builder
     */
    knex() {
        return this.db.knexQuery();
    }
    /**
     * Wrapping database calls inside defer ensures that they run
     * in the right order and also they won't be executed when
     * schema is invoked to return the SQL queries
     */
    defer(cb) {
        this.trackedCalls.push(cb);
    }
    /**
     * Invokes schema `up` method. Returns an array of queries
     * when `dryRun` is set to true
     */
    async execUp() {
        if (this.state === 'completed') {
            throw new Exception('Cannot execute a given schema twice');
        }
        await this.up();
        this.state = 'completed';
        if (this.dryRun) {
            return this.getQueries();
        }
        await this.executeQueries();
        return true;
    }
    /**
     * Invokes schema `down` method. Returns an array of queries
     * when `dryRun` is set to true
     */
    async execDown() {
        if (this.state === 'completed') {
            throw new Exception('Cannot execute a given schema twice');
        }
        await this.down();
        this.state = 'completed';
        if (this.dryRun) {
            return this.getQueries();
        }
        await this.executeQueries();
        return true;
    }
    async up() { }
    async down() { }
}
