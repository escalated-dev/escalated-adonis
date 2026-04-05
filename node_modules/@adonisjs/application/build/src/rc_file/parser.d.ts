import type { RcFile } from '../types.js';
/**
 * Rc file parser is used to parse and validate the `adonisrc.js` file contents.
 */
export declare class RcFileParser {
    #private;
    constructor(rcFile: Record<string, any>);
    /**
     * Parse and validate file contents and merge them with defaults
     */
    parse(): RcFile;
}
