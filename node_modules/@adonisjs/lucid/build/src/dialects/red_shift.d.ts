import { DialectContract, SharedConfigNode, QueryClientContract } from '../types/database.js';
export declare class RedshiftDialect implements DialectContract {
    private client;
    private config;
    readonly name = "redshift";
    readonly supportsAdvisoryLocks = false;
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
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    getAllTables(schemas: string[]): Promise<any[]>;
    /**
     * Returns an array of all views names for one or many schemas
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    getAllViews(schemas: string[]): Promise<any[]>;
    /**
     * Returns an array of all types names
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    getAllTypes(_schemas: string[]): Promise<any[]>;
    /**
     * Returns an array of all domain names
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    getAllDomains(_schemas: string[]): Promise<any[]>;
    /**
     * Truncate redshift table with option to cascade and restart identity.
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    truncate(table: string, cascade?: boolean): Promise<any>;
    /**
     * Drop all tables inside the database
     */
    dropAllTables(schemas: string[]): Promise<void>;
    /**
     * Drop all views inside the database
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    dropAllViews(schemas: string[]): Promise<void>;
    /**
     * Drop all types inside the database
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    dropAllTypes(schemas: string[]): Promise<void>;
    /**
     * Drop all domains inside the database
     *
     * NOTE: ASSUMING FEATURE PARITY WITH POSTGRESQL HERE (NOT TESTED)
     */
    dropAllDomains(schemas: string[]): Promise<void>;
    /**
     * Redshift doesn't support advisory locks. Learn more:
     * https://tableplus.com/blog/2018/10/redshift-vs-postgres-database-comparison.html
     */
    getAdvisoryLock(): Promise<boolean>;
    /**
     * Redshift doesn't support advisory locks. Learn more:
     * https://tableplus.com/blog/2018/10/redshift-vs-postgres-database-comparison.html
     */
    releaseAdvisoryLock(): Promise<boolean>;
}
