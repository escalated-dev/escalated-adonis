import { MultipartFile } from './file.js';
import type { MultipartStream, FileValidationOptions } from '../types.js';
/**
 * Part handler handles the progress of a stream and also internally validates
 * it's size and extension.
 *
 * This class offloads the task of validating a file stream, regardless of how
 * the stream is consumed. For example:
 *
 * In classic scanerio, we will process the file stream and write files to the
 * tmp directory and in more advanced cases, the end user can handle the
 * stream by themselves and report each chunk to this class.
 */
export declare class PartHandler {
    #private;
    /**
     * Creating a new file object for each part inside the multipart
     * form data
     */
    file: MultipartFile;
    constructor(part: MultipartStream, options: Partial<FileValidationOptions & {
        deferValidations: boolean;
    }>);
    /**
     * Start the process the updating the file state
     * to streaming mode.
     */
    begin(): void;
    /**
     * Handles the file upload progress by validating the file size and
     * extension.
     */
    reportProgress(line: Buffer, bufferLength: number): Promise<void>;
    /**
     * Report errors encountered while processing the stream. These can be errors
     * apart from the one reported by this class. For example: The `s3` failure
     * due to some bad credentails.
     */
    reportError(error: any): Promise<void>;
    /**
     * Report success data about the file.
     */
    reportSuccess(data?: {
        filePath?: string;
        tmpPath?: string;
    } & {
        [key: string]: any;
    }): Promise<void>;
}
