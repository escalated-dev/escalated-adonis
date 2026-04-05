import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
/**
 * The command is meant to migrate the database by execute migrations
 * in `up` direction.
 */
export default class Status extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    private migrator?;
    /**
     * Define custom connection
     */
    connection: string;
    /**
     * Not a valid connection
     */
    protected printNotAValidConnection(connection: string): void;
    /**
     * Colorizes the status string
     */
    private colorizeStatus;
    /**
     * Instantiating the migrator instance
     */
    private instantiateMigrator;
    /**
     * Render list inside a table
     */
    private renderList;
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
