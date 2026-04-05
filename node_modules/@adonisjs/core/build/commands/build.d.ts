import { BaseCommand } from '../modules/ace/main.js';
/**
 * Create the production build by compiling TypeScript source and the
 * frontend assets
 */
export default class Build extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    static help: string[];
    ignoreTsErrors?: boolean;
    packageManager?: 'npm' | 'pnpm' | 'yarn' | 'yarn@berry' | 'bun';
    assets?: boolean;
    assetsArgs?: string[];
    /**
     * Build application
     */
    run(): Promise<void>;
}
