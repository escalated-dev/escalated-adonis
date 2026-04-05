import type { Colors } from '@poppinss/colors/types';
import { type REPLServer, type ReplOptions } from 'node:repl';
import type { MethodCallback, MethodOptions, Compiler } from './types.js';
export declare class Repl {
    #private;
    /**
     * Colors reference
     */
    colors: Colors;
    /**
     * Reference to the repl server. Available after the `start` method
     * is invoked
     */
    server?: REPLServer;
    constructor(options?: {
        compiler?: Compiler;
        historyFilePath?: string;
    } & ReplOptions);
    /**
     * Notify by writing to the console
     */
    notify(message: string): void;
    /**
     * Register a callback to be invoked once the server is ready
     */
    ready(callback: (repl: Repl) => void): this;
    /**
     * Register a custom loader function to be added to the context
     */
    addMethod(name: string, handler: MethodCallback, options?: MethodOptions): this;
    /**
     * Returns the collection of registered methods
     */
    getMethods(): {
        [name: string]: {
            handler: MethodCallback;
            options: MethodOptions & {
                width: number;
            };
        };
    };
    /**
     * Register a compiler. Make sure register the compiler before
     * calling the start method
     */
    useCompiler(compiler: Compiler): this;
    /**
     * Start the REPL server
     */
    start(context?: Record<string, any>): this;
}
