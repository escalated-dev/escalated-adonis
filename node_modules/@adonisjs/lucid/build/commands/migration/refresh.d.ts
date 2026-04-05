import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
/**
 * This command reset the database by rolling back to batch 0 and then
 * re-run all migrations.
 */
export default class Refresh extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * Custom connection for running migrations.
     */
    connection: string;
    /**
     * Force command execution in production
     */
    force: boolean;
    /**
     * Perform dry run
     */
    dryRun: boolean;
    /**
     * Run seeders
     */
    seed: boolean;
    /**
     * Display migrations result in one compact single-line output
     */
    compactOutput: boolean;
    /**
     * Disable advisory locks
     */
    disableLocks: boolean;
    /**
     * Converting command properties to arguments
     */
    private getArgs;
    /**
     * Reset all migrations
     */
    private resetMigrations;
    /**
     * Run migrations
     */
    private runMigrations;
    /**
     * Run seeders
     */
    private runDbSeed;
    /**
     * Handle command
     */
    run(): Promise<void>;
}
