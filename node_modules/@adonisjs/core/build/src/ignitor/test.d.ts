import { Ignitor } from './main.js';
import type { ApplicationService } from '../types.js';
/**
 * The Test runner process is used to start the tests runner process
 */
export declare class TestRunnerProcess {
    #private;
    constructor(ignitor: Ignitor);
    /**
     * Register a callback that runs after booting the AdonisJS app
     * and just before the provider's ready hook
     */
    configure(callback: (app: ApplicationService) => Promise<void> | void): this;
    /**
     * Runs a callback after starting the app
     */
    run(callback: (app: ApplicationService) => Promise<void> | void): Promise<void>;
}
