import { BaseCommand } from '../../modules/ace/main.js';
import { CommandOptions } from '../../types/ace.js';
/**
 * Make a new service class
 */
export default class MakeService extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    /**
     * The stub to use for generating the service class
     */
    protected stubPath: string;
    run(): Promise<void>;
}
