import { BaseCommand } from '../modules/ace/main.js';
import { CommandOptions } from '../types/ace.js';
/**
 * The ReplCommand class is used to start the Repl server
 */
export default class ReplCommand extends BaseCommand {
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * Starts the REPL server process
     */
    run(): Promise<void>;
}
