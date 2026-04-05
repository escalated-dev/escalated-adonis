import type tsStatic from 'typescript';
import { type Logger } from '@poppinss/cliui';
import type { TestRunnerOptions } from './types.js';
/**
 * Exposes the API to run Japa tests and optionally watch for file
 * changes to re-run the tests.
 *
 * The watch mode functions as follows.
 *
 *  - If the changed file is a test file, then only tests for that file
 *    will be re-run.
 *  - Otherwise, all tests will re-run with respect to the initial
 *    filters applied when running the `node ace test` command.
 *
 */
export declare class TestRunner {
    #private;
    constructor(cwd: URL, options: TestRunnerOptions);
    /**
     * Set a custom CLI UI logger
     */
    setLogger(logger: Logger): this;
    /**
     * Add listener to get notified when dev server is
     * closed
     */
    onClose(callback: (exitCode: number) => any): this;
    /**
     * Add listener to get notified when dev server exists
     * with an error
     */
    onError(callback: (error: any) => any): this;
    /**
     * Close watchers and running child processes
     */
    close(): Promise<void>;
    /**
     * Runs tests
     */
    run(): Promise<void>;
    /**
     * Run tests in watch mode
     */
    runAndWatch(ts: typeof tsStatic, options?: {
        poll: boolean;
    }): Promise<void>;
}
