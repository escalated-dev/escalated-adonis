import MigrationsBase from './_base.js';
import { CommandOptions } from '@adonisjs/core/types/ace';
/**
 * The command is meant to migrate the database by executing migrations
 * in `up` direction.
 */
export default class Migrate extends MigrationsBase {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    private migrator?;
    /**
     * Custom connection for running migrations.
     */
    connection: string;
    /**
     * Force run migrations in production
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
     * Instantiating the migrator instance
     */
    private instantiateMigrator;
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
