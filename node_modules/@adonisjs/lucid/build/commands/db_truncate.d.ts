import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
export default class DbTruncate extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * Choose a custom pre-defined connection. Otherwise, we use the
     * default connection
     */
    connection: string;
    /**
     * Force command execution in production
     */
    force: boolean;
    /**
     * Not a valid connection
     */
    private printNotAValidConnection;
    /**
     * Prompts to take consent when truncating the database in production
     */
    private takeProductionConsent;
    /**
     * Truncate all tables except adonis migrations table
     */
    private performTruncate;
    /**
     * Run as a subcommand. Never close database connections or exit
     * process inside this method
     */
    private runAsSubCommand;
    /**
     * Branching out, so that if required we can implement
     * "runAsMain" separately from "runAsSubCommand".
     *
     * For now, they both are the same
     */
    private runAsMain;
    /**
     * Handle command
     */
    run(): Promise<void>;
    /**
     * Lifecycle method invoked by ace after the "run"
     * method.
     */
    completed(): Promise<void>;
}
