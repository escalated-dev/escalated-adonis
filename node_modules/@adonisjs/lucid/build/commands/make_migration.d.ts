import { CommandOptions } from '@adonisjs/core/types/ace';
import { BaseCommand } from '@adonisjs/core/ace';
export default class MakeMigration extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * The name of the migration file. We use this to create the migration
     * file and generate the table name
     */
    name: string;
    /**
     * Choose a custom pre-defined connection. Otherwise, we use the
     * default connection
     */
    connection: string;
    /**
     * Pre select migration directory. If this is defined, we will ignore the paths
     * defined inside the config.
     */
    folder: string;
    /**
     * Custom table name for creating a new table
     */
    create: boolean;
    /**
     * Custom table name for altering an existing table
     */
    alter: boolean;
    /**
     * Not a valid connection
     */
    private printNotAValidConnection;
    /**
     * Returns the directory for creating the migration file
     */
    private getDirectory;
    /**
     * Execute command
     */
    run(): Promise<void>;
}
