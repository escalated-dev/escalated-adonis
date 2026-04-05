import type { PathLike } from 'node:fs';
/**
 * Attempts to read a file from multiple sources and returns the contents
 * of the first matching one. `null` is returned when file does not
 * exist in any of the sources.
 */
export declare function readFileFromSources(fileName: string, sources: string[]): Promise<{
    contents: string;
    filePath: string;
    fileName: string;
    source: string;
} | null>;
/**
 * Optionally read the contents of a file
 */
export declare function readFileOptional(filePath: URL | string): Promise<string | null>;
/**
 * Check if a file for the given path exists
 */
export declare function pathExists(path: PathLike): Promise<boolean>;
/**
 * Parsers exports from a stub
 */
export declare function parseStubExports(contents: string): {
    attributes: Record<string, any>;
    body: string;
};
