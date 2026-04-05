import type { HttpContext } from '@adonisjs/http-server';
import type { FileValidationOptions, PartHandler as PartHandlerType } from '../types.js';
/**
 * Multipart class offers a low level API to interact the incoming
 * HTTP request data as a stream. This makes it super easy to
 * write files to s3 without saving them to the disk first.
 */
export declare class Multipart {
    #private;
    /**
     * The current state of the multipart form handler
     */
    state: 'idle' | 'processing' | 'error' | 'success';
    constructor(ctx: HttpContext, config?: Partial<{
        limit: string | number;
        fieldsLimit: string | number;
        maxFields: number;
        convertEmptyStringsToNull: boolean;
    }>, 
    /**
     * Will be enabled in the next major release
     */
    featureFlags?: {
        mergeFieldsAndFiles: boolean;
    });
    /**
     * Attach handler for a given file. To handle all files, you
     * can attach a wildcard handler.
     *
     * @example
     * ```ts
     * multipart.onFile('package', {}, async (stream) => {
     * })
     *
     * multipart.onFile('*', {}, async (stream) => {
     * })
     * ```
     */
    onFile(name: string, options: Partial<FileValidationOptions & {
        deferValidations: boolean;
    }>, handler: PartHandlerType): this;
    /**
     * Abort request by emitting error
     */
    abort(error: any): void;
    /**
     * Process the request by going all the file and field
     * streams.
     */
    process(config?: Partial<{
        limit: string | number;
        maxFields: number;
    }>): Promise<void>;
}
