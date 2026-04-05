import { BaseCommand } from '../modules/ace/main.js';
/**
 * Prints the RcFile file contents to the terminal
 */
export default class InspectRCFile extends BaseCommand {
    static commandName: string;
    static description: string;
    run(): Promise<void>;
}
