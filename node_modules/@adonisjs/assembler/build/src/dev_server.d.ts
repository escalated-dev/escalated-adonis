import type tsStatic from 'typescript';
import { type Logger } from '@poppinss/cliui';
import type { DevServerOptions } from './types.js';
/**
 * Exposes the API to start the development. Optionally, the watch API can be
 * used to watch for file changes and restart the development server.
 *
 * The Dev server performs the following actions
 *
 * - Assigns a random PORT, when PORT inside .env file is in use.
 * - Uses tsconfig.json file to collect a list of files to watch.
 * - Uses metaFiles from adonisrc.ts file to collect a list of files to watch.
 * - Restart HTTP server on every file change.
 */
export declare class DevServer {
    #private;
    constructor(cwd: URL, options: DevServerOptions);
    /**
     * Set a custom CLI UI logger
     */
    setLogger(logger: Logger): this;
    /**
     * Add listener to get notified when dev server is
     * closed
     */
    onClose(callback: (exitCode: number) => any): this;
    /**
     * Add listener to get notified when dev server exists
     * with an error
     */
    onError(callback: (error: any) => any): this;
    /**
     * Close watchers and running child processes
     */
    close(): Promise<void>;
    /**
     * Start the development server
     */
    start(): Promise<void>;
    /**
     * Start the development server in watch mode
     */
    startAndWatch(ts: typeof tsStatic, options?: {
        poll: boolean;
    }): Promise<void>;
}
