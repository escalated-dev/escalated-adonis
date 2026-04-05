import Macroable from '@poppinss/macroable';
import type { FileJSON, FileUploadError, FileValidationOptions } from '../types.js';
/**
 * The file holds the meta/data for an uploaded file, along with
 * an errors occurred during the upload process.
 */
export declare class MultipartFile extends Macroable {
    #private;
    /**
     * A boolean to know if file is an instance of this class
     * or not
     */
    isMultipartFile: true;
    /**
     * Field name is the name of the field
     */
    fieldName: string;
    /**
     * Client name is the file name on the user client
     */
    clientName: string;
    /**
     * The headers sent as part of the multipart request
     */
    headers: Record<string, any>;
    /**
     * File size in bytes
     */
    size: number;
    /**
     * The extname for the file.
     */
    extname?: string;
    /**
     * Upload errors
     */
    errors: FileUploadError[];
    /**
     * Type and subtype are extracted from the `content-type`
     * header or from the file magic number
     */
    type?: string;
    subtype?: string;
    /**
     * File path is only set after the move operation
     */
    filePath?: string;
    /**
     * File name is only set after the move operation. It is the relative
     * path of the moved file
     */
    fileName?: string;
    /**
     * Tmp path, only exists when file is uploaded using the
     * classic mode.
     */
    tmpPath?: string;
    /**
     * The file meta data
     */
    meta: any;
    /**
     * The state of the file
     */
    state: 'idle' | 'streaming' | 'consumed' | 'moved';
    /**
     * Whether or not the validations have been executed
     */
    get validated(): boolean;
    /**
     * A boolean to know if file has one or more errors
     */
    get isValid(): boolean;
    /**
     * Opposite of [[this.isValid]]
     */
    get hasErrors(): boolean;
    /**
     * The maximum file size limit
     */
    get sizeLimit(): number | string | undefined;
    set sizeLimit(limit: number | string | undefined);
    /**
     * Extensions allowed
     */
    get allowedExtensions(): string[] | undefined;
    set allowedExtensions(extensions: string[] | undefined);
    constructor(data: {
        fieldName: string;
        clientName: string;
        headers: any;
    }, validationOptions: Partial<FileValidationOptions>);
    /**
     * Validate the file
     */
    validate(): void;
    /**
     * Mark file as moved
     */
    markAsMoved(fileName: string, filePath: string): void;
    /**
     * Moves the file to a given location. Multiple calls to the `move` method are allowed,
     * incase you want to move a file to multiple locations.
     */
    move(location: string, options?: {
        name?: string;
        overwrite?: boolean;
    }): Promise<void>;
    /**
     * Returns file JSON representation
     */
    toJSON(): FileJSON;
}
