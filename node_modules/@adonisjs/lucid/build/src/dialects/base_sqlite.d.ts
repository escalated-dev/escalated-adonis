import type { DialectContract, QueryClientContract, SharedConfigNode } from '../types/database.js';
export declare abstract class BaseSqliteDialect implements DialectContract {
    private client;
    private config;
    abstract readonly name: 'sqlite3' | 'better-sqlite3' | 'libsql';
    readonly supportsAdvisoryLocks = false;
    readonly supportsViews = true;
    readonly supportsTypes = false;
    readonly supportsDomains = false;
    readonly supportsReturningStatement = false;
    /**
     * Reference to the database version. Knex.js fetches the version after
     * the first database query, so it will be set to undefined initially
     */
    readonly version: string;
    /**
     * The default format for datetime column. The date formats is
     * valid for luxon date parsing library
     */
    readonly dateTimeFormat = "yyyy-MM-dd HH:mm:ss";
    constructor(client: QueryClientContract, config: SharedConfigNode);
    /**
     * Returns an array of table names
     */
    getAllTables(): Promise<any[]>;
    /**
     * Returns an array of all views names
     */
    getAllViews(): Promise<string[]>;
    /**
     * Returns an array of all types names
     */
    getAllTypes(): Promise<string[]>;
    /**
     * Returns an array of all domains names
     */
    getAllDomains(): Promise<string[]>;
    /**
     * Truncate SQLITE tables
     */
    truncate(table: string): Promise<void>;
    /**
     * Drop all tables inside the database
     */
    dropAllTables(): Promise<void>;
    /**
     * Drop all views inside the database
     */
    dropAllViews(): Promise<void>;
    /**
     * Drop all custom types inside the database
     */
    dropAllTypes(): Promise<void>;
    /**
     * Drop all custom domains inside the database
     */
    dropAllDomains(): Promise<void>;
    /**
     * Attempts to add advisory lock to the database and
     * returns it's status.
     */
    getAdvisoryLock(): Promise<boolean>;
    /**
     * Releases the advisory lock
     */
    releaseAdvisoryLock(): Promise<boolean>;
}
