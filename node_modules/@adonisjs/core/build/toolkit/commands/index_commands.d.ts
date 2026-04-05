import { BaseCommand } from '@adonisjs/ace';
/**
 * Generates index of commands with a loader. Must be called against
 * the TypeScript compiled output.
 */
export default class IndexCommand extends BaseCommand {
    static commandName: string;
    static description: string;
    commandsDir: string;
    run(): Promise<any>;
}
