import { MultipartFile } from '../file.js';
/**
 * Validates the file extension
 */
export declare class ExtensionValidator {
    #private;
    validated: boolean;
    /**
     * Update the expected file extensions
     */
    get extensions(): string[] | undefined;
    set extensions(extnames: string[] | undefined);
    constructor(file: MultipartFile);
    /**
     * Validate the file
     */
    validate(): void;
}
