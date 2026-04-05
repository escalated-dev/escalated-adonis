import { DialectContract, SharedConfigNode, QueryClientContract } from '../types/database.js';
export declare class MysqlDialect implements DialectContract {
    private client;
    private config;
    readonly name = "mysql";
    readonly supportsAdvisoryLocks = true;
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
     * Truncate mysql table with option to cascade
     */
    truncate(table: string, cascade?: boolean): Promise<void>;
    /**
     * Returns an array of table names
     */
    getAllTables(): Promise<string[]>;
    /**
     * Returns an array of all views names
     */
    getAllViews(): Promise<string[]>;
    /**
     * Returns an array of all types names
     */
    getAllTypes(): Promise<string[]>;
    /**
     * Returns an array of all domain names
     */
    getAllDomains(): Promise<string[]>;
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
     * Drop all domains inside the database
     */
    dropAllDomains(): Promise<void>;
    /**
     * Attempts to add advisory lock to the database and
     * returns it's status.
     */
    getAdvisoryLock(key: string, timeout?: number): Promise<boolean>;
    /**
     * Releases the advisory lock
     */
    releaseAdvisoryLock(key: string): Promise<boolean>;
}
