/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import vine, { symbols, BaseLiteralType } from '@vinejs/vine';
const MULTIPART_FILE = symbols.SUBTYPE ?? Symbol.for('subtype');
/**
 * Checks if the value is an instance of multipart file
 * from bodyparser.
 */
function isBodyParserFile(file) {
    return !!(file && typeof file === 'object' && 'isMultipartFile' in file);
}
/**
 * VineJS validation rule that validates the file to be an
 * instance of BodyParser MultipartFile class.
 */
const isMultipartFile = vine.createRule((file, options, field) => {
    /**
     * Report error when value is not a field multipart
     * file object
     */
    if (!isBodyParserFile(file)) {
        field.report('The {{ field }} must be a file', 'file', field);
        return;
    }
    const validationOptions = typeof options === 'function' ? options(field) : options;
    /**
     * Set size when it's defined in the options and missing
     * on the file instance
     */
    if (file.sizeLimit === undefined && validationOptions.size) {
        file.sizeLimit = validationOptions.size;
    }
    /**
     * Set extensions when it's defined in the options and missing
     * on the file instance
     */
    if (file.allowedExtensions === undefined && validationOptions.extnames) {
        file.allowedExtensions = validationOptions.extnames;
    }
    /**
     * Validate file
     */
    file.validate();
    /**
     * Report errors
     */
    file.errors.forEach((error) => {
        field.report(error.message, `file.${error.type}`, field, validationOptions);
    });
});
/**
 * Represents a multipart file uploaded via multipart/form-data HTTP
 * request.
 */
export class VineMultipartFile extends BaseLiteralType {
    #validationOptions;
    [MULTIPART_FILE] = 'multipartFile';
    constructor(validationOptions, options, validations) {
        super(options, validations || [isMultipartFile(validationOptions || {})]);
        this.#validationOptions = validationOptions;
    }
    clone() {
        return new VineMultipartFile(this.#validationOptions, this.cloneOptions(), this.cloneValidations());
    }
}
