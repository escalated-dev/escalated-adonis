import { BaseCommand } from '../../modules/ace/main.js';
declare const ALLOWED_ENVIRONMENTS: ("web" | "console" | "test" | "repl")[];
type AllowedAppEnvironments = typeof ALLOWED_ENVIRONMENTS;
/**
 * Make a new preload file
 */
export default class MakePreload extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    name: string;
    register?: boolean;
    environments?: AllowedAppEnvironments;
    /**
     * The stub to use for generating the preload file
     */
    protected stubPath: string;
    /**
     * Run command
     */
    run(): Promise<void>;
}
export {};
