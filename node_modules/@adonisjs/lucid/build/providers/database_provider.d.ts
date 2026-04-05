import type { ApplicationService } from '@adonisjs/core/types';
import { Database } from '../src/database/main.js';
import { DatabaseTestUtils } from '../src/test_utils/database.js';
import type { ConnectionContract, DbQueryEventNode } from '../src/types/database.js';
import { VineDbSearchCallback, VineDbSearchOptions } from '../src/types/vine.js';
/**
 * Extending AdonisJS types
 */
declare module '@adonisjs/core/types' {
    interface ContainerBindings {
        'lucid.db': Database;
    }
    interface EventsList {
        'db:query': DbQueryEventNode;
        'db:connection:connect': ConnectionContract;
        'db:connection:disconnect': ConnectionContract;
        'db:connection:error': [Error, ConnectionContract];
    }
}
declare module '@adonisjs/core/test_utils' {
    interface TestUtils {
        db(connectionName?: string): DatabaseTestUtils;
    }
}
/**
 * Extending VineJS schema types
 */
declare module '@vinejs/vine' {
    interface VineLucidBindings<ValueType> {
        /**
         * Ensure the value is unique inside the database by table and column name.
         * Optionally, you can define a filter to narrow down the query.
         */
        unique(options: VineDbSearchOptions<ValueType>): this;
        /**
         * Ensure the value is unique inside the database by self
         * executing a query.
         *
         * - The callback must return "true", if the value is unique (does not exist).
         * - The callback must return "false", if the value is not unique (already exists).
         */
        unique(callback: VineDbSearchCallback<ValueType>): this;
        /**
         * Ensure the value exists inside the database by table and column name.
         * Optionally, you can define a filter to narrow down the query.
         */
        exists(options: VineDbSearchOptions<ValueType>): this;
        /**
         * Ensure the value exists inside the database by self
         * executing a query.
         *
         * - The callback must return "true", if the value exists.
         * - The callback must return "false", if the value does not exist.
         */
        exists(callback: VineDbSearchCallback<ValueType>): this;
    }
    interface VineNumber extends VineLucidBindings<number> {
    }
    interface VineString extends VineLucidBindings<string> {
    }
}
/**
 * Database service provider
 */
export default class DatabaseServiceProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    /**
     * Registers repl bindings when running the application
     * in the REPL environment
     */
    protected registerReplBindings(): Promise<void>;
    /**
     * Registers validation rules for VineJS
     */
    protected registerVineJSRules(db: Database): Promise<void>;
    /**
     * Register TestUtils database macro
     */
    protected registerTestUtils(): Promise<void>;
    /**
     * Registeres a listener to pretty print debug queries
     */
    protected prettyPrintDebugQueries(db: Database): Promise<void>;
    /**
     * Invoked by AdonisJS to register container bindings
     */
    register(): void;
    /**
     * Invoked by AdonisJS to extend the framework or pre-configure
     * objects
     */
    boot(): Promise<void>;
    /**
     * Gracefully close connections during shutdown
     */
    shutdown(): Promise<void>;
}
