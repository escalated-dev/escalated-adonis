import type { CommandOptions } from '../types/ace.js';
import { BaseCommand } from '../modules/ace/main.js';
/**
 * The configure command is used to configure packages after installation
 */
export default class Configure extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    /**
     * Exposing all flags from the protected property "parsed"
     */
    get parsedFlags(): {
        [argName: string]: any;
    };
    /**
     * Exposing all args from the protected property "parsed"
     */
    get parsedArgs(): (string | number)[];
    /**
     * Name of the package to configure
     */
    name: string;
    /**
     * Turn on verbose mode for packages installation
     */
    verbose?: boolean;
    /**
     * Forcefully overwrite existing files.
     */
    force?: boolean;
    /**
     * The root of the stubs directory. The value is defined after we import
     * the package
     */
    stubsRoot: string;
    /**
     * Creates codemods as per configure command options
     */
    createCodemods(): Promise<import("../modules/ace/codemods.js").Codemods>;
    /**
     * Run method is invoked by ace automatically
     */
    run(): Promise<void>;
}
