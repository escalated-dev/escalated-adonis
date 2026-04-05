import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
export default class DbWipe extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * Choose a custom pre-defined connection. Otherwise, we use the
     * default connection
     */
    connection: string;
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
     * Force command execution in production
     */
    force: boolean;
    /**
     * Not a valid connection
     */
    private printNotAValidConnection;
    /**
     * Prompts to take consent when wiping the database in production
     */
    private takeProductionConsent;
    /**
     * Drop all views (if asked for and supported)
     */
    private performDropViews;
    /**
     * Drop all tables
     */
    private performDropTables;
    /**
     * Drop all types (if asked for and supported)
     */
    private performDropTypes;
    /**
     * Drop all domains (if asked for and supported)
     */
    private performDropDomains;
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
