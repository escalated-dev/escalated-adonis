import { BaseCommand } from '../modules/ace/main.js';
/**
 * The eject command is used to eject templates to the user
 * application codebase for customizing them
 */
export default class Eject extends BaseCommand {
    static commandName: string;
    static description: string;
    stubPath: string;
    pkg: string;
    run(): Promise<void>;
}
