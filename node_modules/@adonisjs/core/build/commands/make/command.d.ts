import { BaseCommand } from '../../modules/ace/main.js';
/**
 * Make a new ace command
 */
export default class MakeCommand extends BaseCommand {
    static commandName: string;
    static description: string;
    name: string;
    /**
     * The stub to use for generating the command class
     */
    protected stubPath: string;
    run(): Promise<void>;
}
