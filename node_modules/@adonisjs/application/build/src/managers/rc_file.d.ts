import type { RcFile } from '../types.js';
/**
 * RcFileManager is used to process the raw contents or the contents
 * of "adonisrc.js" file.
 */
export declare class RcFileManager {
    #private;
    /**
     * Reference to the parsed rc file. The value is defined
     * after the "init" method call
     */
    rcFile: RcFile;
    constructor(appRoot: URL);
    /**
     * Specify the contents of the "adonisrc.js" file as
     * an object. Calling this method will disable loading
     * the "adonisrc.js" file from the disk.
     */
    rcContents(value: Record<string, any>): this;
    /**
     * Process the contents for the rcFile
     */
    process(): Promise<void>;
}
