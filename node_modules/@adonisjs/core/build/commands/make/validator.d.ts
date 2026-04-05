import { BaseCommand } from '../../modules/ace/main.js';
import { CommandOptions } from '../../types/ace.js';
/**
 * Make a new VineJS validator
 */
export default class MakeValidator extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    resource: boolean;
    /**
     * The stub to use for generating the validator
     */
    protected stubPath: string;
    /**
     * Preparing the command state
     */
    prepare(): Promise<void>;
    run(): Promise<void>;
}
