import { BaseCommand } from '../../modules/ace/main.js';
/**
 * Make a new EdgeJS template file
 */
export default class MakeView extends BaseCommand {
    static commandName: string;
    static description: string;
    name: string;
    /**
     * The stub to use for generating the template
     */
    protected stubPath: string;
    run(): Promise<void>;
}
