import { DialectContract, QueryClientContract } from '../types/database.js';
export declare class OracleDialect implements DialectContract {
    private client;
    readonly name = "oracledb";
    readonly supportsAdvisoryLocks = false;
    readonly supportsViews = false;
    readonly supportsTypes = false;
    readonly supportsDomains = false;
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
    readonly dateTimeFormat = "yyyy-MM-dd HH:mm:ss";
    constructor(client: QueryClientContract);
    /**
     * Not implemented yet
     */
    getAllTables(): Promise<any>;
    /**
     * Truncate pg table with option to cascade and restart identity
     */
    truncate(table: string, cascade?: boolean): Promise<any>;
    /**
     * Not implemented yet
     */
    dropAllTables(): Promise<void>;
    getAllViews(): Promise<string[]>;
    getAllTypes(): Promise<string[]>;
    getAllDomains(): Promise<string[]>;
    dropAllViews(): Promise<void>;
    dropAllTypes(): Promise<void>;
    dropAllDomains(): Promise<void>;
    getAdvisoryLock(): Promise<boolean>;
    releaseAdvisoryLock(): Promise<boolean>;
}
