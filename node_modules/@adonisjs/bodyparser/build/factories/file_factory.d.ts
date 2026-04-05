import { MultipartFile } from '../src/multipart/file.js';
import { FileValidationOptions } from '../src/types.js';
type FileFactoryParameters = {
    fieldName: string;
    clientName: string;
    headers: any;
    size: number;
    extname: string;
    type: string;
    subtype: string;
};
/**
 * File factory exposes the API to create fake multipart file instances
 * for testing
 */
export declare class MultipartFileFactory {
    #private;
    /**
     * Merge factory params
     */
    merge(params: Partial<FileFactoryParameters>): this;
    /**
     * Create an instance of multipart file
     */
    create(validationOptions?: Partial<FileValidationOptions>): MultipartFile;
}
export {};
