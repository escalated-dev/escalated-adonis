import { Argument, UIPrimitives } from '../types.js';
/**
 * The argument formatter formats an argument as per the http://docopt.org/ specification.
 */
export declare class ArgumentFormatter {
    #private;
    constructor(argument: Argument, colors: UIPrimitives['colors']);
    /**
     * Returns formatted description for the argument
     */
    formatDescription(): string;
    /**
     * Returns a formatted version of the argument name to be displayed
     * inside a list
     */
    formatListOption(): string;
    /**
     * Returns a formatted version of the argument name to
     * be displayed next to usage
     */
    formatOption(): string;
}
