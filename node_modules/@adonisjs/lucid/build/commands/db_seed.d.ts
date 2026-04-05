import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
export default class DbSeed extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    private seeder;
    /**
     * Track if one or more seeders have failed
     */
    private hasError;
    /**
     * Choose a custom pre-defined connection. Otherwise, we use the
     * default connection
     */
    connection: string;
    /**
     * Interactive mode allows selecting seeder files
     */
    interactive: boolean;
    /**
     * Define a custom set of seeder files. Interactive and files together ignores
     * the interactive mode.
     */
    files: string[];
    /**
     * Display migrations result in one compact single-line output
     */
    compactOutput: boolean;
    /**
     * Print log message to the console
     */
    private printLogMessage;
    /**
     * Not a valid connection
     */
    private printNotAValidConnection;
    /**
     * Print log that the selected seeder file is invalid
     */
    private printNotAValidFile;
    /**
     * Get files cherry picked using either "--interactive" or the
     * "--files" flag
     */
    private getCherryPickedFiles;
    /**
     * Instantiate seeders runner
     */
    private instantiateSeeder;
    /**
     * Execute selected seeders
     */
    private executedSeeders;
    /**
     * Print Single-line output when `compact-output` is enabled
     */
    private logCompactFinalStatus;
    /**
     * Run as a subcommand. Never close database connection or exit
     * process here
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
