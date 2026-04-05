import type { TestRunner } from '@adonisjs/assembler';
import type { CommandOptions } from '../types/ace.js';
import { BaseCommand } from '../modules/ace/main.js';
/**
 * Test command is used to run tests with optional file watcher. Under the
 * hood, we run "bin/test.js" file.
 */
export default class Test extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    testsRunner: TestRunner;
    suites?: string[];
    files?: string[];
    tags?: string[];
    groups?: string[];
    tests?: string[];
    reporters?: string[];
    watch?: boolean;
    poll?: boolean;
    timeout?: number;
    retries?: number;
    failed?: boolean;
    clear?: boolean;
    assets?: boolean;
    assetsArgs?: string[];
    /**
     * Runs tests
     */
    run(): Promise<void>;
}
