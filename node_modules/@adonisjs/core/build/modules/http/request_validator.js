/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
/**
 * Request validator is used validate HTTP request data using
 * VineJS validators. You may validate the request body,
 * files, cookies, and headers.
 */
export class RequestValidator {
    #ctx;
    #experimentalFlags;
    constructor(ctx, experimentalFlags) {
        this.#ctx = ctx;
        this.#experimentalFlags = experimentalFlags;
    }
    /**
     * The error reporter method returns the error reporter
     * to use for reporting errors.
     *
     * You can use this function to pick a different error reporter
     * for each HTTP request
     */
    static errorReporter;
    /**
     * The messages provider method returns the messages provider to use
     * finding custom error messages
     *
     * You can use this function to pick a different messages provider for
     * each HTTP request
     */
    static messagesProvider;
    /**
     * The validate method can be used to validate the request
     * data for the current request using VineJS validators
     */
    validateUsing(validator, ...[options]) {
        const validatorOptions = options || {};
        /**
         * Assign request specific error reporter
         */
        if (RequestValidator.errorReporter && !validatorOptions.errorReporter) {
            const errorReporter = RequestValidator.errorReporter(this.#ctx);
            validatorOptions.errorReporter = () => errorReporter;
        }
        /**
         * Assign request specific messages provider
         */
        if (RequestValidator.messagesProvider && !validatorOptions.messagesProvider) {
            validatorOptions.messagesProvider = RequestValidator.messagesProvider(this.#ctx);
        }
        const requestBody = this.#experimentalFlags?.enabled('mergeMultipartFieldsAndFiles')
            ? this.#ctx.request.all()
            : {
                ...this.#ctx.request.all(),
                ...this.#ctx.request.allFiles(),
            };
        /**
         * Data to validate
         */
        const data = validatorOptions.data || {
            ...requestBody,
            params: this.#ctx.request.params(),
            headers: this.#ctx.request.headers(),
            cookies: this.#ctx.request.cookiesList(),
        };
        return validator.validate(data, validatorOptions);
    }
}
