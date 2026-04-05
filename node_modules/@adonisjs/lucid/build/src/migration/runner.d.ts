import { EventEmitter } from 'node:events';
import { MigratorOptions, MigratedFileNode, MigrationListNode } from '../types/migrator.js';
import { Database } from '../database/main.js';
import { Application } from '@adonisjs/core/app';
/**
 * Migrator exposes the API to execute migrations using the schema files
 * for a given connection at a time.
 */
export declare class MigrationRunner extends EventEmitter {
    private db;
    private app;
    private options;
    private client;
    private config;
    /**
     * Reference to the migrations config for the given connection
     */
    private migrationsConfig;
    /**
     * Table names for storing schema files and schema versions
     */
    private schemaTableName;
    private schemaVersionsTableName;
    /**
     * Whether the migrator has been booted
     */
    private booted;
    /**
     * Migration source to collect schema files from the disk
     */
    private migrationSource;
    /**
     * Flag to know if running the app in production
     */
    isInProduction: boolean;
    /**
     * Mode decides in which mode the migrator is executing migrations. The migrator
     * instance can only run in one mode at a time.
     *
     * The value is set when `migrate` or `rollback` method is invoked
     */
    direction: 'up' | 'down';
    /**
     * Instead of executing migrations, just return the generated SQL queries
     */
    dryRun: boolean;
    /**
     * Disable advisory locks
     */
    disableLocks: boolean;
    /**
     * An array of files we have successfully migrated. The files are
     * collected regardless of `up` or `down` methods
     */
    migratedFiles: {
        [file: string]: MigratedFileNode;
    };
    /**
     * Last error occurred when executing migrations
     */
    error: null | Error;
    /**
     * Current status of the migrator
     */
    get status(): "error" | "pending" | "completed" | "skipped";
    /**
     * Existing version of migrations. We use versioning to upgrade
     * existing migrations if we are plan to make a breaking
     * change.
     */
    version: number;
    constructor(db: Database, app: Application<any>, options: MigratorOptions);
    /**
     * Returns the client for a given schema file. Schema instructions are
     * wrapped in a transaction unless transaction is not disabled
     */
    private getClient;
    /**
     * Roll back the transaction when it's client is a transaction client
     */
    private rollback;
    /**
     * Commits a transaction when it's client is a transaction client
     */
    private commit;
    /**
     * Writes the migrated file to the migrations table. This ensures that
     * we are not re-running the same migration again
     */
    private recordMigrated;
    /**
     * Removes the migrated file from the migrations table. This allows re-running
     * the migration
     */
    private recordRollback;
    /**
     * Returns the migration source by ensuring value is a class constructor and
     * has disableTransactions property.
     */
    private getMigrationSource;
    /**
     * Executes a given migration node and cleans up any created transactions
     * in case of failure
     */
    private executeMigration;
    /**
     * Acquires a lock to disallow concurrent transactions. Only works with
     * `Mysql`, `PostgresSQL` and `MariaDb` for now.
     *
     * Make sure we are acquiring lock outside the transactions, since we want
     * to block other processes from acquiring the same lock.
     *
     * Locks are always acquired in dry run too, since we want to stay close
     * to the real execution cycle
     */
    private acquireLock;
    /**
     * Release a lock once complete the migration process. Only works with
     * `Mysql`, `PostgresSQL` and `MariaDb` for now.
     */
    private releaseLock;
    /**
     * Makes the migrations table (if missing). Also created in dry run, since
     * we always reads from the schema table to find which migrations files to
     * execute and that cannot be done without missing table.
     */
    private makeMigrationsTable;
    /**
     * Makes the migrations version table (if missing).
     */
    private makeMigrationsVersionsTable;
    /**
     * Returns the latest migrations version. If no rows exist
     * it inserts a new row for version 1
     */
    private getLatestVersion;
    /**
     * Upgrade migrations name from version 1 to version 2
     */
    private upgradeFromOneToTwo;
    /**
     * Upgrade migrations version
     */
    private upgradeVersion;
    /**
     * Returns the latest batch from the migrations
     * table
     */
    private getLatestBatch;
    /**
     * Returns an array of files migrated till now
     */
    private getMigratedFiles;
    /**
     * Returns an array of files migrated till now. The latest
     * migrations are on top
     */
    private getMigratedFilesTillBatch;
    /**
     * Boot the migrator to perform actions. All boot methods must
     * work regardless of dryRun is enabled or not.
     */
    private boot;
    /**
     * Shutdown gracefully
     */
    private shutdown;
    /**
     * Migrate up
     */
    private runUp;
    /**
     * Migrate down (aka rollback)
     */
    private runDown;
    on(event: 'start', callback: () => void): this;
    on(event: 'end', callback: () => void): this;
    on(event: 'acquire:lock', callback: () => void): this;
    on(event: 'release:lock', callback: () => void): this;
    on(event: 'create:schema:table', callback: () => void): this;
    on(event: 'create:schema_versions:table', callback: () => void): this;
    on(event: 'upgrade:version', callback: (payload: {
        from: number;
        to: number;
    }) => void): this;
    on(event: 'migration:start', callback: (file: MigratedFileNode) => void): this;
    on(event: 'migration:completed', callback: (file: MigratedFileNode) => void): this;
    on(event: 'migration:error', callback: (file: MigratedFileNode) => void): this;
    /**
     * Returns a merged list of completed and pending migrations
     */
    getList(): Promise<MigrationListNode[]>;
    /**
     * Migrate the database by calling the up method
     */
    run(): Promise<void>;
    /**
     * Close database connections
     */
    close(): Promise<void>;
}
