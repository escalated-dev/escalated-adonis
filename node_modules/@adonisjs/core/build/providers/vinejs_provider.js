/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { Vine } from '@vinejs/vine';
import { Request, RequestValidator } from '../modules/http/main.js';
import { VineMultipartFile } from '../src/vine.js';
/**
 * The Edge service provider configures Edge to work within
 * an AdonisJS application environment
 */
export default class VineJSServiceProvider {
    app;
    constructor(app) {
        this.app = app;
        this.app.usingVineJS = true;
    }
    boot() {
        const experimentalFlags = this.app.experimentalFlags;
        /**
         * The file method is used to validate a field to be a valid
         * multipart file.
         */
        Vine.macro('file', function (options) {
            return new VineMultipartFile(options);
        });
        /**
         * The validate method can be used to validate the request
         * data for the current request using VineJS validators
         */
        Request.macro('validateUsing', function (...args) {
            return new RequestValidator(this.ctx, experimentalFlags).validateUsing(...args);
        });
    }
}
