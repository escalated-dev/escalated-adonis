import type { SourceFilesManagerOptions } from './types.js';
/**
 * Exposes the API to manage the source files for a typescript project.
 * All paths are stored as unix paths
 */
export declare class SourceFilesManager {
    #private;
    constructor(appRoot: string, options: SourceFilesManagerOptions);
    /**
     * Track a new source file
     */
    add(filePath: string): void;
    /**
     * Remove file from the list of existing source files
     */
    remove(filePath: string): void;
    /**
     * Returns true when filePath is part of the source files after checking
     * them against `includes`, `excludes` and custom set of `files`.
     */
    isSourceFile(filePath: string): boolean;
    /**
     * Returns true if the file should be watched
     */
    shouldWatch(filePath: string): boolean;
    /**
     * Returns a copy of project source files
     */
    toJSON(): Record<string, boolean>;
}
