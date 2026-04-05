/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import debug from '../debug.js';
import { AceProcess } from './ace.js';
import { TestRunnerProcess } from './test.js';
import { HttpServerProcess } from './http.js';
import { setApp } from '../../services/app.js';
import { Application } from '../../modules/app.js';
/**
 * Ignitor is used to instantiate an AdonisJS application in different
 * known environments.
 */
export class Ignitor {
    /**
     * Ignitor options
     */
    #options;
    /**
     * Application root URL
     */
    #appRoot;
    /**
     * Reference to the application instance created using
     * the "createApp" method.
     *
     * We store the output of the last call made to "createApp" method
     * and assume that in one process only one entrypoint will
     * call this method.
     */
    #app;
    /**
     * Reference to the created application
     */
    #tapCallbacks = new Set();
    constructor(appRoot, options = {}) {
        this.#appRoot = appRoot;
        this.#options = options;
    }
    /**
     * Runs all the tap callbacks
     */
    #runTapCallbacks(app) {
        this.#tapCallbacks.forEach((tapCallback) => tapCallback(app));
    }
    /**
     * Get access to the application instance created
     * by either the http server process or the ace
     * process
     */
    getApp() {
        return this.#app;
    }
    /**
     * Create an instance of AdonisJS application
     */
    createApp(environment) {
        debug('creating application instance');
        this.#app = new Application(this.#appRoot, { environment, importer: this.#options.importer });
        setApp(this.#app);
        this.#runTapCallbacks(this.#app);
        return this.#app;
    }
    /**
     * Tap to access the application class instance.
     */
    tap(callback) {
        this.#tapCallbacks.add(callback);
        return this;
    }
    /**
     * Get instance of the HTTPServerProcess
     */
    httpServer() {
        return new HttpServerProcess(this);
    }
    /**
     * Get an instance of the AceProcess class
     */
    ace() {
        return new AceProcess(this);
    }
    /**
     * Get an instance of the TestRunnerProcess class
     */
    testRunner() {
        return new TestRunnerProcess(this);
    }
    /**
     * Terminates the app by calling the "app.terminate"
     * method
     */
    async terminate() {
        await this.#app?.terminate();
    }
}
