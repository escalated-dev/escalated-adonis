import { BaseCommand } from '../../modules/ace/main.js';
import { CommandOptions } from '../../types/ace.js';
/**
 * The make controller command to create an HTTP controller
 */
export default class MakeController extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    actions?: string[];
    singular: boolean;
    resource: boolean;
    api: boolean;
    /**
     * The stub to use for generating the controller
     */
    protected stubPath: string;
    /**
     * Preparing the command state
     */
    prepare(): Promise<void>;
    run(): Promise<void>;
}
