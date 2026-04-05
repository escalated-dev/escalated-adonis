import { BaseCommand } from '../../modules/ace/main.js';
import { CommandOptions } from '../../types/ace.js';
/**
 * The make event command to create a class based event
 */
export default class MakeEvent extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    /**
     * The stub to use for generating the event
     */
    protected stubPath: string;
    run(): Promise<void>;
}
