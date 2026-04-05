import { Kernel } from './main.js';
import type { ApplicationService } from '../../src/types.js';
/**
 * We abstract the logic for creating the ace kernel in this
 * file. So that both the "console" environment and rest
 * of the environments can configure and use ace.
 *
 * - In console environment, ace manages the lifecycle of the process
 * - In other environments, ace can be pulled from the container to
 * run commands
 */
export declare function createAceKernel(app: ApplicationService, commandName?: string): Kernel;
