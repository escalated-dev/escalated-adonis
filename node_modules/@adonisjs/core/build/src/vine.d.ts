import { symbols, BaseLiteralType } from '@vinejs/vine';
import type { Validation, FieldContext, FieldOptions } from '@vinejs/vine/types';
import type { MultipartFile, FileValidationOptions } from '@adonisjs/bodyparser/types';
declare const MULTIPART_FILE: typeof symbols.SUBTYPE;
/**
 * Validation options accepted by the "file" rule
 */
export type FileRuleValidationOptions = Partial<FileValidationOptions> | ((field: FieldContext) => Partial<FileValidationOptions>);
/**
 * Represents a multipart file uploaded via multipart/form-data HTTP
 * request.
 */
export declare class VineMultipartFile extends BaseLiteralType<MultipartFile, MultipartFile, MultipartFile> {
    #private;
    [MULTIPART_FILE]: string;
    constructor(validationOptions?: FileRuleValidationOptions, options?: FieldOptions, validations?: Validation<any>[]);
    clone(): this;
}
export {};
