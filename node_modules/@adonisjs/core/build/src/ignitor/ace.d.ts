import { Ignitor } from './main.js';
import type { ApplicationService } from '../types.js';
/**
 * The Ace process is used to start the application in the
 * console environment.
 */
export declare class AceProcess {
    #private;
    constructor(ignitor: Ignitor);
    /**
     * Register a callback that can be used to configure the ace
     * kernel before the handle method is called
     */
    configure(callback: (app: ApplicationService) => Promise<void> | void): this;
    /**
     * Handles the command line arguments and executes
     * the matching ace commands
     */
    handle(argv: string[]): Promise<void>;
}
