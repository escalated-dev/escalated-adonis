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
     * Run seeders
     */
    seed: boolean;
    /**
     * Drop all views in database
     */
    dropViews: boolean;
    /**
     * Drop all types in database
     */
    dropTypes: boolean;
    /**
     * Drop all domains in database
     */
    dropDomains: boolean;
    /**
     * Disable advisory locks
     */
    disableLocks: boolean;
    /**
     * Converting command properties to arguments
     */
    private getArgs;
    /**
     * Converting command properties to db:wipe arguments
     */
    private getWipeArgs;
    /**
     * Wipe the database
     */
    private runDbWipe;
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
