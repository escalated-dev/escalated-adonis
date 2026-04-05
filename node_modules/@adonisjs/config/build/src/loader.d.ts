/**
 * The config loader imports all the script files from a given directory
 * and returns their exports as a tree of objects.
 *
 * Following file extensions are considered script files.
 *
 * - .js
 * - .ts (without .d.ts)
 * - .json
 * - .cjs
 * - .mjs
 */
export declare class ConfigLoader {
    #private;
    constructor(configDir: string | URL);
    /**
     * Load config files as a tree from a given path.
     */
    load(): Promise<any>;
}
