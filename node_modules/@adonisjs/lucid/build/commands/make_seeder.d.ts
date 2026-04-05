import { BaseCommand } from '@adonisjs/core/ace';
import { CommandOptions } from '@adonisjs/core/types/ace';
export default class MakeSeeder extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * The name of the seeder file.
     */
    name: string;
    /**
     * Execute command
     */
    run(): Promise<void>;
}
