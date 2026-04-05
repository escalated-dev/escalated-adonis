import { Application } from '@adonisjs/core/app';
import { FileNode } from '../types/database.js';
import { SeederFileNode } from '../types/seeder.js';
import { Database } from '../database/main.js';
/**
 * Seeds Runner exposes the API to traverse seeders and execute them
 * in bulk
 */
export declare class SeedsRunner {
    private db;
    private app;
    private connectionName?;
    private client;
    private config;
    nodeEnvironment: string;
    constructor(db: Database, app: Application<any>, connectionName?: string | undefined);
    /**
     * Returns the seeder source by ensuring value is a class constructor
     */
    private getSeederSource;
    /**
     * Returns an array of seeders
     */
    getList(): Promise<FileNode<unknown>[]>;
    /**
     * Executes the seeder
     */
    run(file: FileNode<unknown>): Promise<SeederFileNode>;
    /**
     * Close database connections
     */
    close(): Promise<void>;
}
