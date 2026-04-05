import { BaseCommand } from '../../modules/ace/main.js';
/**
 * Make a new test file
 */
export default class MakeTest extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    name: string;
    suite?: string;
    /**
     * The stub to use for generating the test file
     */
    protected stubPath: string;
    /**
     * Executed by ace
     */
    run(): Promise<void>;
}
