/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { BaseCommand as AceBaseCommand, ListCommand as AceListCommand } from '@adonisjs/ace';
/**
 * The base command to create custom ace commands. The AdonisJS base commands
 * receives the application instance
 */
export class BaseCommand extends AceBaseCommand {
    app;
    kernel;
    static options = {};
    get staysAlive() {
        return this.constructor.options.staysAlive;
    }
    get startApp() {
        return this.constructor.options.startApp;
    }
    constructor(app, kernel, parsed, ui, prompt) {
        super(kernel, parsed, ui, prompt);
        this.app = app;
        this.kernel = kernel;
    }
    /**
     * Creates the codemods module to modify source files
     */
    async createCodemods() {
        const { Codemods } = await import('./codemods.js');
        const codemods = new Codemods(this.app, this.logger);
        codemods.on('error', () => {
            this.exitCode = 1;
        });
        return codemods;
    }
    /**
     * Executes the command
     */
    async exec() {
        this.hydrate();
        try {
            /**
             * Executing the template methods
             */
            this.prepare && (await this.app.container.call(this, 'prepare'));
            this.interact && (await this.app.container.call(this, 'interact'));
            const result = await this.app.container.call(this, 'run');
            /**
             * Set exit code
             */
            this.result = this.result === undefined ? result : this.result;
            this.exitCode = this.exitCode ?? 0;
        }
        catch (error) {
            this.error = error;
            this.exitCode = this.exitCode ?? 1;
        }
        /**
         * Run the completed method (if exists) and check if has handled
         * the error
         */
        let errorHandled = this.completed
            ? await this.app.container.call(this, 'completed')
            : false;
        if (this.error && !errorHandled) {
            await this.kernel.errorHandler.render(this.error, this.kernel);
        }
        return this.result;
    }
    /**
     * Terminate the app. A command should prefer calling this method
     * over the "app.terminate", because this method only triggers
     * app termination when the current command is in the charge
     * of the process.
     */
    async terminate() {
        if (this.kernel.getMainCommand() === this) {
            await this.app.terminate();
        }
    }
}
/**
 * The List command is used to display a list of commands
 */
export class ListCommand extends AceListCommand {
    app;
    kernel;
    static options = {};
    get staysAlive() {
        return this.constructor.options.staysAlive;
    }
    get startApp() {
        return this.constructor.options.startApp;
    }
    constructor(app, kernel, parsed, ui, prompt) {
        super(kernel, parsed, ui, prompt);
        this.app = app;
        this.kernel = kernel;
    }
    /**
     * Creates the codemods module to modify source files
     */
    async createCodemods() {
        const { Codemods } = await import('./codemods.js');
        return new Codemods(this.app, this.logger);
    }
    /**
     * Terminate the app. A command should prefer calling this method
     * over the "app.terminate", because this method only triggers
     * app termination when the current command is in the charge
     * of the process.
     */
    async terminate() {
        if (this.kernel.getMainCommand() === this) {
            await this.app.terminate();
        }
    }
}
