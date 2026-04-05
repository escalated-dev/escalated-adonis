import { BaseCommand } from '../../modules/ace/main.js';
declare const ALLOWED_ENVIRONMENTS: ("web" | "console" | "test" | "repl")[];
type AllowedAppEnvironments = typeof ALLOWED_ENVIRONMENTS;
/**
 * Make a new provider class
 */
export default class MakeProvider extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    name: string;
    register?: boolean;
    environments?: AllowedAppEnvironments;
    /**
     * The stub to use for generating the provider class
     */
    protected stubPath: string;
    run(): Promise<void>;
}
export {};
