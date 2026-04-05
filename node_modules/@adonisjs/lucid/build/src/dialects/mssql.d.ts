import { DialectContract, SharedConfigNode, QueryClientContract } from '../types/database.js';
export declare class MssqlDialect implements DialectContract {
    private client;
    private config;
    readonly name = "mssql";
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
    readonly dateTimeFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZZ";
    constructor(client: QueryClientContract, config: SharedConfigNode);
    /**
     * Returns an array of table names
     */
    getAllTables(): Promise<any[]>;
    /**
     * Truncate mssql table. Disabling foreign key constriants alone is
     * not enough for SQL server.
     *
     * One has to drop all FK constraints and then re-create them, and
     * this all is too much work
     */
    truncate(table: string, _: boolean): Promise<void>;
    /**
     * Drop all tables inside the database
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
