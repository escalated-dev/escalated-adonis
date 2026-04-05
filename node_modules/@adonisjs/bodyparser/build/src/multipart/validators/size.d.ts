import { MultipartFile } from '../file.js';
/**
 * Size validator validates the file size
 */
export declare class SizeValidator {
    #private;
    validated: boolean;
    /**
     * Defining the maximum bytes the file can have
     */
    get maxLimit(): number | string | undefined;
    set maxLimit(limit: number | string | undefined);
    constructor(file: MultipartFile);
    /**
     * Validate the file size
     */
    validate(): void;
}
