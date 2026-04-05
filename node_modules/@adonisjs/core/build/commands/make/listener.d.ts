import { BaseCommand } from '../../modules/ace/main.js';
import { CommandOptions } from '../../types/ace.js';
/**
 * The make listener command to create a class based event
 * listener
 */
export default class MakeListener extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    event: string;
    /**
     * The stub to use for generating the event listener
     */
    protected stubPath: string;
    prepare(): void;
    run(): Promise<void>;
}
