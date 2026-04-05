import type { ApplicationService } from '../src/types.js';
import { RequestValidator } from '../modules/http/main.js';
import { FileRuleValidationOptions, VineMultipartFile } from '../src/vine.js';
/**
 * Extend VineJS
 */
declare module '@vinejs/vine' {
    interface Vine {
        file(options?: FileRuleValidationOptions): VineMultipartFile;
    }
}
/**
 * Extend HTTP request class
 */
declare module '@adonisjs/core/http' {
    interface Request extends RequestValidator {
    }
}
/**
 * The Edge service provider configures Edge to work within
 * an AdonisJS application environment
 */
export default class VineJSServiceProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    boot(): void;
}
