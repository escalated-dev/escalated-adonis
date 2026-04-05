import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
export default class MakeModel extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * The name of the model file.
     */
    name: string;
    /**
     * Defines if we generate the migration for the model.
     */
    migration: boolean;
    /**
     * Defines if we generate the controller for the model.
     */
    controller: boolean;
    /**
     * Defines if we generate the factory for the model.
     */
    factory: boolean;
    /**
     * Run migrations
     */
    private runMakeMigration;
    /**
     * Make controller
     */
    private runMakeController;
    /**
     * Make factory
     */
    private runMakeFactory;
    /**
     * Execute command
     */
    run(): Promise<void>;
}
