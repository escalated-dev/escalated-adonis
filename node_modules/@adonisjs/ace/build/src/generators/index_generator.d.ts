/**
 * The index generators creates a commands laoder that can be lazily
 * imported.
 *
 * Also, a command.json index file is created that has metadata for all
 * the files. Doing so, speeds up the commands lookup, as we do not
 * have to import all the classes just to find if a command exists
 * or not.
 */
export declare class IndexGenerator {
    #private;
    constructor(commandsDir: string);
    /**
     * Generate index
     */
    generate(): Promise<any>;
}
