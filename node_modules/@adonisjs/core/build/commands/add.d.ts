import { CommandOptions } from '../types/ace.js';
import { BaseCommand } from '../modules/ace/main.js';
declare const KNOWN_PACKAGE_MANAGERS: readonly ["npm", "pnpm", "bun", "yarn", "yarn@berry", "pnpm@6"];
/**
 * The install command is used to `npm install` and `node ace configure` a new package
 * in one go.
 */
export default class Add extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    verbose?: boolean;
    packageManager?: (typeof KNOWN_PACKAGE_MANAGERS)[number];
    dev?: boolean;
    force?: boolean;
    /**
     * Run method is invoked by ace automatically
     */
    run(): Promise<void>;
}
export {};
