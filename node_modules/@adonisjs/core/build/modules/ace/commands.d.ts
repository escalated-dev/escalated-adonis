import { BaseCommand as AceBaseCommand, ListCommand as AceListCommand } from '@adonisjs/ace';
import { Kernel } from './kernel.js';
import type { ApplicationService } from '../../src/types.js';
import type { CommandOptions, ParsedOutput, UIPrimitives } from '../../types/ace.js';
/**
 * The base command to create custom ace commands. The AdonisJS base commands
 * receives the application instance
 */
export declare class BaseCommand extends AceBaseCommand {
    app: ApplicationService;
    kernel: Kernel;
    static options: CommandOptions;
    get staysAlive(): boolean | undefined;
    get startApp(): boolean | undefined;
    constructor(app: ApplicationService, kernel: Kernel, parsed: ParsedOutput, ui: UIPrimitives, prompt: Kernel['prompt']);
    /**
     * Creates the codemods module to modify source files
     */
    createCodemods(): Promise<import("./codemods.js").Codemods>;
    /**
     * The prepare template method is used to prepare the
     * state for the command. This is the first method
     * executed on a given command instance.
     */
    prepare?(..._: any[]): any;
    /**
     * The interact template method is used to display the prompts
     * to the user. The method is called after the prepare
     * method.
     */
    interact?(..._: any[]): any;
    /**
     * The completed method is the method invoked after the command
     * finishes or results in an error.
     *
     * You can access the command error using the `this.error` property.
     * Returning `true` from completed method supresses the error
     * reporting to the kernel layer.
     */
    completed?(..._: any[]): any;
    /**
     * Executes the command
     */
    exec(): Promise<any>;
    /**
     * Terminate the app. A command should prefer calling this method
     * over the "app.terminate", because this method only triggers
     * app termination when the current command is in the charge
     * of the process.
     */
    terminate(): Promise<void>;
}
/**
 * The List command is used to display a list of commands
 */
export declare class ListCommand extends AceListCommand implements BaseCommand {
    app: ApplicationService;
    kernel: Kernel;
    static options: CommandOptions;
    get staysAlive(): boolean | undefined;
    get startApp(): boolean | undefined;
    constructor(app: ApplicationService, kernel: Kernel, parsed: ParsedOutput, ui: UIPrimitives, prompt: Kernel['prompt']);
    /**
     * Creates the codemods module to modify source files
     */
    createCodemods(): Promise<import("./codemods.js").Codemods>;
    /**
     * Terminate the app. A command should prefer calling this method
     * over the "app.terminate", because this method only triggers
     * app termination when the current command is in the charge
     * of the process.
     */
    terminate(): Promise<void>;
}
