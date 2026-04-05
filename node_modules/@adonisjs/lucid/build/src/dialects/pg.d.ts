import { DialectContract, SharedConfigNode, QueryClientContract } from '../types/database.js';
export declare class PgDialect implements DialectContract {
    private client;
    private config;
    readonly name = "postgres";
    readonly supportsAdvisoryLocks = true;
    readonly supportsViews = true;
    readonly supportsTypes = true;
    readonly supportsDomains = true;
    readonly supportsReturningStatement = true;
    /**
     * Reference to the database version. Knex.js fetches the version after
     * the first database query, so it will be set to undefined initially
     */
    readonly version: string;
    /**
     * The default format for datetime column. The date formats is
     * valid for luxon date parsing library
     */
    readonly dateTimeFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZZ";
    constructor(client: QueryClientContract, config: SharedConfigNode);
    /**
     * Returns an array of table names for one or many schemas.
     */
    getAllTables(schemas: string[]): Promise<any[]>;
    /**
     * Returns an array of all views names for one or many schemas
     */
    getAllViews(schemas: string[]): Promise<any[]>;
    /**
     * Returns an array of all types names
     */
    getAllTypes(_schemas: string[]): Promise<any[]>;
    /**
     * Returns an array of all domain names
     */
    getAllDomains(_schemas: string[]): Promise<any[]>;
    /**
     * Truncate pg table with option to cascade and restart identity
     */
    truncate(table: string, cascade?: boolean): Promise<any>;
    /**
     * Drop all tables inside the database
     */
    dropAllTables(schemas: string[]): Promise<void>;
    /**
     * Drop all views inside the database
     */
    dropAllViews(schemas: string[]): Promise<void>;
    /**
     * Drop all types inside the database
     */
    dropAllTypes(schemas: string[]): Promise<void>;
    /**
     * Drop all domains inside the database
     */
    dropAllDomains(schemas: string[]): Promise<void>;
    /**
     * Attempts to add advisory lock to the database and
     * returns it's status.
     */
    getAdvisoryLock(key: string): Promise<boolean>;
    /**
     * Releases the advisory lock
     */
    releaseAdvisoryLock(key: string): Promise<boolean>;
}
