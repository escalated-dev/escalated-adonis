/*
 * @adonisjs/lucid
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { Database } from '../src/database/main.js';
import { Adapter } from '../src/orm/adapter/index.js';
import { QueryClient } from '../src/query_client/index.js';
import { BaseModel } from '../src/orm/base_model/index.js';
import { DatabaseTestUtils } from '../src/test_utils/database.js';
/**
 * Database service provider
 */
export default class DatabaseServiceProvider {
    app;
    constructor(app) {
        this.app = app;
    }
    /**
     * Registers repl bindings when running the application
     * in the REPL environment
     */
    async registerReplBindings() {
        if (this.app.getEnvironment() === 'repl') {
            const { defineReplBindings } = await import('../src/bindings/repl.js');
            defineReplBindings(this.app, await this.app.container.make('repl'));
        }
    }
    /**
     * Registers validation rules for VineJS
     */
    async registerVineJSRules(db) {
        if (this.app.usingVineJS) {
            const { defineValidationRules } = await import('../src/bindings/vinejs.js');
            defineValidationRules(db);
        }
    }
    /**
     * Register TestUtils database macro
     */
    async registerTestUtils() {
        this.app.container.resolving('testUtils', async () => {
            const { TestUtils } = await import('@adonisjs/core/test_utils');
            TestUtils.macro('db', (connectionName) => {
                return new DatabaseTestUtils(this.app, connectionName);
            });
        });
    }
    /**
     * Registeres a listener to pretty print debug queries
     */
    async prettyPrintDebugQueries(db) {
        if (db.config.prettyPrintDebugQueries) {
            const emitter = await this.app.container.make('emitter');
            emitter.on('db:query', db.prettyPrint);
        }
    }
    /**
     * Invoked by AdonisJS to register container bindings
     */
    register() {
        this.app.container.singleton(Database, async (resolver) => {
            const config = this.app.config.get('database');
            const emitter = await resolver.make('emitter');
            const logger = await resolver.make('logger');
            const db = new Database(config, logger, emitter);
            return db;
        });
        this.app.container.singleton(QueryClient, async (resolver) => {
            const db = await resolver.make('lucid.db');
            return db.connection();
        });
        this.app.container.alias('lucid.db', Database);
    }
    /**
     * Invoked by AdonisJS to extend the framework or pre-configure
     * objects
     */
    async boot() {
        const db = await this.app.container.make('lucid.db');
        BaseModel.$adapter = new Adapter(db);
        await this.prettyPrintDebugQueries(db);
        await this.registerTestUtils();
        await this.registerReplBindings();
        await this.registerVineJSRules(db);
    }
    /**
     * Gracefully close connections during shutdown
     */
    async shutdown() {
        const db = await this.app.container.make('lucid.db');
        await db.manager.closeAll();
    }
}
