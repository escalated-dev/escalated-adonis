/**
 * Representation of a directory in the listing
 * of objects.
 */
export declare class DriveDirectory {
    prefix: string;
    isFile: false;
    isDirectory: true;
    name: string;
    constructor(prefix: string);
}
