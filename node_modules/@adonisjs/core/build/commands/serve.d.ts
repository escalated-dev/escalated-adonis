import type { DevServer } from '@adonisjs/assembler';
import type { CommandOptions } from '../types/ace.js';
import { BaseCommand } from '../modules/ace/main.js';
/**
 * Serve command is used to run the AdonisJS HTTP server during development. The
 * command under the hood runs the "bin/server.ts" file and watches for file
 * system changes
 */
export default class Serve extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    static help: string[];
    static options: CommandOptions;
    devServer: DevServer;
    hmr?: boolean;
    watch?: boolean;
    poll?: boolean;
    clear?: boolean;
    assets?: boolean;
    assetsArgs?: string[];
    /**
     * Runs the HTTP server
     */
    run(): Promise<void>;
}
