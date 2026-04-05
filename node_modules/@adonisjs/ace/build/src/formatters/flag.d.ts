import { Flag, UIPrimitives } from '../types.js';
/**
 * The flag formatter formats a flag as per the http://docopt.org/ specification.
 */
export declare class FlagFormatter {
    #private;
    constructor(flag: Flag, colors: UIPrimitives['colors']);
    /**
     * Returns formatted description for the flag
     */
    formatDescription(): string;
    /**
     * Returns a formatted version of the flag name and aliases
     */
    formatOption(): string;
}
