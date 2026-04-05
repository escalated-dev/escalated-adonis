import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
/**
 * This command resets the database by rolling back to batch 0. Same
 * as calling "migration:rollback --batch=0"
 */
export default class Reset extends BaseCommand {
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
     * Handle command
     */
    run(): Promise<void>;
}
