import { CommandOptions } from '@adonisjs/core/types/ace';
import { BaseCommand } from '@adonisjs/core/ace';
/**
 * Command to make a new Factory
 */
export default class MakeFactory extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * Name of the model to be used in the factory
     */
    model: string;
    run(): Promise<void>;
}
