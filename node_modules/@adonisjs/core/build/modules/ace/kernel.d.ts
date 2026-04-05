import { Kernel as AceKernel } from '@adonisjs/ace';
import { BaseCommand } from './commands.js';
import type { ApplicationService } from '../../src/types.js';
/**
 * The base command to create custom ace commands. The AdonisJS base commands
 * receives the application instance
 */
export declare class Kernel extends AceKernel<typeof BaseCommand> {
    app: ApplicationService;
    constructor(app: ApplicationService);
}
