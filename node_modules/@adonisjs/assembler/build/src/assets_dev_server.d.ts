import { type Logger } from '@poppinss/cliui';
import type { AssetsBundlerOptions } from './types.js';
/**
 * Exposes the API to start the development server for processing assets during
 * development.
 *
 * - Here we are running the assets dev server in a child process.
 * - Piping the output from the child process and reformatting it before writing it to
 *   process streams.
 *
 * AssetsDevServer is agnostic and can run any assets dev server. Be it Vite or Encore or
 * even Webpack directly.
 */
export declare class AssetsDevServer {
    #private;
    constructor(cwd: URL, options?: AssetsBundlerOptions);
    /**
     * Set a custom CLI UI logger
     */
    setLogger(logger: Logger): this;
    /**
     * Starts the assets bundler server. The assets bundler server process is
     * considered as the secondary process and therefore we do not perform
     * any cleanup if it dies.
     */
    start(): void;
    /**
     * Stop the dev server
     */
    stop(): void;
}
