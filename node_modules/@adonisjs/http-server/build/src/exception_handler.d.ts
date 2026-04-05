import Macroable from '@poppinss/macroable';
import type { Level } from '@adonisjs/logger/types';
import type { HttpContext } from './http_context/main.js';
import type { HttpError, StatusPageRange, StatusPageRenderer } from './types/server.js';
/**
 * The base HTTP exception handler one can inherit from to handle
 * HTTP exceptions.
 *
 * The HTTP exception handler has support for
 *
 * - Ability to render exceptions by calling the render method on the exception.
 * - Rendering status pages
 * - Pretty printing errors during development
 * - Transforming errors to JSON or HTML using content negotiation
 * - Reporting errors
 */
export declare class ExceptionHandler extends Macroable {
    #private;
    /**
     * Whether or not to render debug info. When set to true, the errors
     * will have the complete error stack.
     */
    protected debug: boolean;
    /**
     * Whether or not to render status pages. When set to true, the unhandled
     * errors with matching status codes will be rendered using a status
     * page.
     */
    protected renderStatusPages: boolean;
    /**
     * A collection of error status code range and the view to render.
     */
    protected statusPages: Record<StatusPageRange, StatusPageRenderer>;
    /**
     * Enable/disable errors reporting
     */
    protected reportErrors: boolean;
    /**
     * An array of exception classes to ignore when
     * reporting an error
     */
    protected ignoreExceptions: any[];
    /**
     * An array of HTTP status codes to ignore when reporting
     * an error
     */
    protected ignoreStatuses: number[];
    /**
     * An array of error codes to ignore when reporting
     * an error
     */
    protected ignoreCodes: string[];
    /**
     * Error reporting context
     */
    protected context(ctx: HttpContext): any;
    /**
     * Returns the log level for an error based upon the error
     * status code.
     */
    protected getErrorLogLevel(error: HttpError): Level;
    /**
     * A boolean to control if errors should be rendered with
     * all the available debugging info.
     */
    protected isDebuggingEnabled(_: HttpContext): boolean;
    /**
     * Returns a boolean by checking if an error should be reported.
     */
    protected shouldReport(error: HttpError): boolean;
    /**
     * Renders an error to JSON response
     */
    renderErrorAsJSON(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Renders an error to JSON API response
     */
    renderErrorAsJSONAPI(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Renders an error to HTML response
     */
    renderErrorAsHTML(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Renders the validation error message to a JSON
     * response
     */
    renderValidationErrorAsJSON(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Renders the validation error message as per JSON API
     * spec
     */
    renderValidationErrorAsJSONAPI(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Renders the validation error as an HTML string
     */
    renderValidationErrorAsHTML(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Renders the error to response
     */
    renderError(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Renders the validation error to response
     */
    renderValidationError(error: HttpError, ctx: HttpContext): Promise<void>;
    /**
     * Reports an error during an HTTP request
     */
    report(error: unknown, ctx: HttpContext): Promise<void>;
    /**
     * Handles the error during the HTTP request.
     */
    handle(error: unknown, ctx: HttpContext): Promise<any>;
}
