import { type Repl } from './repl.js';
/**
 * Custom method callback function
 */
export type MethodCallback = (repl: Repl, ...args: any[]) => any;
/**
 * Options that can be set when defining a custom method
 */
export type MethodOptions = {
    description?: string;
    usage?: string;
};
/**
 * Shape of the Compiler that must be passed to the
 * repl constructor
 */
export type Compiler = {
    compile: (code: string, fileName: string) => string;
    supportsTypescript: boolean;
};
