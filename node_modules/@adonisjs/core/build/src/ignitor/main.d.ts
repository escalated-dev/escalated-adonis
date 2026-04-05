import { AceProcess } from './ace.js';
import { TestRunnerProcess } from './test.js';
import { HttpServerProcess } from './http.js';
import type { AppEnvironments } from '../../types/app.js';
import type { ApplicationService, IgnitorOptions } from '../types.js';
/**
 * Ignitor is used to instantiate an AdonisJS application in different
 * known environments.
 */
export declare class Ignitor {
    #private;
    constructor(appRoot: URL, options?: IgnitorOptions);
    /**
     * Get access to the application instance created
     * by either the http server process or the ace
     * process
     */
    getApp(): ApplicationService | undefined;
    /**
     * Create an instance of AdonisJS application
     */
    createApp(environment: AppEnvironments): ApplicationService;
    /**
     * Tap to access the application class instance.
     */
    tap(callback: (app: ApplicationService) => void): this;
    /**
     * Get instance of the HTTPServerProcess
     */
    httpServer(): HttpServerProcess;
    /**
     * Get an instance of the AceProcess class
     */
    ace(): AceProcess;
    /**
     * Get an instance of the TestRunnerProcess class
     */
    testRunner(): TestRunnerProcess;
    /**
     * Terminates the app by calling the "app.terminate"
     * method
     */
    terminate(): Promise<void>;
}
