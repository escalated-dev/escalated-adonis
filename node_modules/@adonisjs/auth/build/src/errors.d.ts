import type { HttpContext } from '@adonisjs/core/http';
/**
 * The "E_UNAUTHORIZED_ACCESS" exception is raised when unable to
 * authenticate an incoming HTTP request.
 *
 * The "error.guardDriverName" can be used to know the driver which
 * raised the error.
 */
export declare const E_UNAUTHORIZED_ACCESS: {
    new (message: string, options: {
        redirectTo?: string;
        guardDriverName: string;
    }): {
        /**
         * Endpoint to redirect to. Only used by "session" driver
         * renderer
         */
        redirectTo?: string;
        /**
         * Translation identifier. Can be customized
         */
        identifier: string;
        /**
         * The guard name reference that raised the exception. It allows
         * us to customize the logic of handling the exception.
         */
        guardDriverName: string;
        /**
         * A collection of renderers to render the exception to a
         * response.
         *
         * The collection is a key-value pair, where the key is
         * the guard driver name and value is a factory function
         * to respond to the request.
         */
        renderers: Record<string, (message: string, error: /*elided*/ any, ctx: HttpContext) => Promise<void> | void>;
        /**
         * Returns the message to be sent in the HTTP response.
         * Feel free to override this method and return a custom
         * response.
         */
        getResponseMessage(error: /*elided*/ any, ctx: HttpContext): string;
        /**
         * Converts exception to an HTTP response
         */
        handle(error: /*elided*/ any, ctx: HttpContext): Promise<void>;
        name: string;
        help?: string;
        code?: string;
        status: number;
        toString(): string;
        get [Symbol.toStringTag](): string;
        message: string;
        stack?: string;
        cause?: unknown;
    };
    status: number;
    code: string;
    help?: string;
    message?: string;
    isError(error: unknown): error is Error;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
/**
 * Exception is raised when user credentials are invalid
 */
export declare const E_INVALID_CREDENTIALS: {
    new (message?: string, options?: ErrorOptions & {
        code?: string;
        status?: number;
    }): {
        /**
         * Translation identifier. Can be customized
         */
        identifier: string;
        /**
         * Returns the message to be sent in the HTTP response.
         * Feel free to override this method and return a custom
         * response.
         */
        getResponseMessage(error: /*elided*/ any, ctx: HttpContext): string;
        /**
         * Converts exception to an HTTP response
         */
        handle(error: /*elided*/ any, ctx: HttpContext): Promise<void>;
        name: string;
        help?: string;
        code?: string;
        status: number;
        toString(): string;
        get [Symbol.toStringTag](): string;
        message: string;
        stack?: string;
        cause?: unknown;
    };
    status: number;
    code: string;
    help?: string;
    message?: string;
    isError(error: unknown): error is Error;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
