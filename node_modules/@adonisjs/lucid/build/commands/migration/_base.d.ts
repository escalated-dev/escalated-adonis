import { BaseCommand } from '@adonisjs/core/ace';
import type { MigrationRunner } from '../../src/migration/runner.js';
import { MigratedFileNode } from '../../src/types/migrator.js';
/**
 * Base class to execute migrations and print logs
 */
export default abstract class MigrationsBase extends BaseCommand {
    /**
     * Should print one-liner compact output
     */
    protected compactOutput: boolean;
    /**
     * Not a valid connection
     */
    protected printNotAValidConnection(connection: string): void;
    /**
     * Prompts to take consent for running migrations in production
     */
    protected takeProductionConsent(): Promise<boolean>;
    /**
     * Returns beautified log message string
     */
    protected printLogMessage(file: MigratedFileNode, direction: 'down' | 'up'): void;
    /**
     * Pretty print sql queries of a file
     */
    private prettyPrintSql;
    /**
     * Log final status with verbose output
     */
    private logVerboseFinalStatus;
    /**
     * Log final status with compact output
     */
    private logCompactFinalStatus;
    /**
     * Runs the migrations using the migrator
     */
    protected runMigrations(migrator: MigrationRunner, connectionName: string): Promise<void>;
}
