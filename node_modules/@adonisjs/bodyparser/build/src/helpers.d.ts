import type { Mode } from 'node:fs';
/**
 * We can detect file types for these files using the magic
 * number
 */
export declare const supportMagicFileTypes: ReadonlySet<string>;
/**
 * Returns the file `type`, `subtype` and `extension`.
 */
export declare function getFileType(fileContents: Buffer): Promise<null | {
    ext: string;
    type?: string;
    subtype?: string;
}>;
/**
 * Computes file name from the file type
 */
export declare function computeFileTypeFromName(clientName: string, headers: {
    [key: string]: string;
}): {
    ext: string;
    type?: string;
    subtype?: string;
};
/**
 * Check if a file already exists
 */
export declare function pathExists(filePath: string): Promise<boolean>;
/**
 * Move file from source to destination with a fallback to move file across
 * paritions and devices.
 */
export declare function moveFile(sourcePath: string, destinationPath: string, options?: {
    overwrite: boolean;
    directoryMode?: Mode;
}): Promise<void>;
