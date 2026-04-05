import type tsStatic from 'typescript';
import { type Logger } from '@poppinss/cliui';
import type { BundlerOptions } from './types.js';
type SupportedPackageManager = 'npm' | 'yarn' | 'yarn@berry' | 'pnpm' | 'bun';
/**
 * The bundler class exposes the API to build an AdonisJS project.
 */
export declare class Bundler {
    #private;
    constructor(cwd: URL, ts: typeof tsStatic, options: BundlerOptions);
    /**
     * Set a custom CLI UI logger
     */
    setLogger(logger: Logger): this;
    /**
     * Bundles the application to be run in production
     */
    bundle(stopOnError?: boolean, client?: SupportedPackageManager): Promise<boolean>;
}
export {};
