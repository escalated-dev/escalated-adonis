import { BaseCommand } from '../../modules/ace/main.js';
import { CommandOptions } from '../../types/ace.js';
/**
 * Make a new exception class
 */
export default class MakeException extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    /**
     * The stub to use for generating the command class
     */
    protected stubPath: string;
    run(): Promise<void>;
}
