import { Exception } from '@poppinss/utils';
import type { HttpContext } from './http_context/main.js';
export declare const E_ROUTE_NOT_FOUND: new (args: [method: string, url: string], options?: ErrorOptions) => Exception;
export declare const E_CANNOT_LOOKUP_ROUTE: new (args: [routeIdentifier: string], options?: ErrorOptions) => Exception;
export declare const E_HTTP_EXCEPTION: {
    new (message?: string, options?: ErrorOptions & {
        code?: string;
        status?: number;
    }): {
        body: any;
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
    code: string;
    /**
     * This method returns an instance of the exception class
     */
    invoke(body: any, status: number, code?: string): {
        body: any;
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
    help?: string;
    status?: number;
    message?: string;
    isError(error: unknown): error is Error;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
export declare const E_HTTP_REQUEST_ABORTED: {
    new (message?: string, options?: ErrorOptions & {
        code?: string;
        status?: number;
    }): {
        handle(error: /*elided*/ any, ctx: HttpContext): void;
        body: any;
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
    code: string;
    /**
     * This method returns an instance of the exception class
     */
    invoke(body: any, status: number, code?: string): {
        body: any;
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
    help?: string;
    status?: number;
    message?: string;
    isError(error: unknown): error is Error;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
