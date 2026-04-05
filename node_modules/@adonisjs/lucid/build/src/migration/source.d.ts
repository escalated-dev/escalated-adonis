import type { Application } from '@adonisjs/core/app';
import { SharedConfigNode, FileNode } from '../types/database.js';
/**
 * Migration source exposes the API to read the migration files
 * from disk for a given connection.
 */
export declare class MigrationSource {
    private config;
    private app;
    constructor(config: SharedConfigNode, app: Application<any>);
    /**
     * Returns an array of files inside a given directory. Relative
     * paths are resolved from the project root
     */
    private getDirectoryFiles;
    /**
     * Returns an array of migrations paths for a given connection. If paths
     * are not defined, then `database/migrations` fallback is used
     */
    private getMigrationsPath;
    /**
     * Returns an array of files for all defined directories
     */
    getMigrations(): Promise<FileNode<unknown>[]>;
}
