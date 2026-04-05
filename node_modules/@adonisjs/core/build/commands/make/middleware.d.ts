import { BaseCommand } from '../../modules/ace/main.js';
import { CommandOptions } from '../../types/ace.js';
/**
 * The make middleware command to create a new middleware
 * class.
 */
export default class MakeMiddleware extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    stack?: 'server' | 'named' | 'router';
    /**
     * The stub to use for generating the middleware
     */
    protected stubPath: string;
    run(): Promise<void>;
}
