import { Exception } from '@poppinss/utils';
import { LucidModel } from './types/model.js';
export declare const E_INVALID_DATE_COLUMN_VALUE: new (args: [string, string | null], options?: ErrorOptions) => Exception;
export declare const E_UNMANAGED_DB_CONNECTION: new (args: [string], options?: ErrorOptions) => Exception;
export declare const E_MISSING_MODEL_ATTRIBUTE: new (args: [string, string, string], options?: ErrorOptions) => Exception;
export declare const E_INCOMPLETE_REPLICAS_CONFIG: new (args?: any, options?: ErrorOptions) => Exception;
export declare const E_INVALID_REPLICAS_CONFIG: new (args?: any, options?: ErrorOptions) => Exception;
export declare const E_MODEL_DELETED: new (args?: any, options?: ErrorOptions) => Exception;
/**
 * The "E_ROW_NOT_FOUND" exception is raised when
 * no row is found in a database single query
 *
 * The "error.model" can be used to know the model which
 * raised the error. This will only be present when using
 * Lucid models not Database queries
 */
export declare const E_ROW_NOT_FOUND: {
    new (model?: LucidModel): {
        /**
         * The model that raised the error.
         */
        model?: LucidModel;
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
    readonly status: number;
    readonly code: string;
    readonly message: string;
    help?: string;
    isError(error: unknown): error is Error;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
export declare const E_UNABLE_ACQUIRE_LOCK: new (args?: any, options?: ErrorOptions) => Exception;
export declare const E_UNABLE_RELEASE_LOCK: new (args?: any, options?: ErrorOptions) => Exception;
export declare const E_MISSING_SCHEMA_FILES: new (args?: any, options?: ErrorOptions) => Exception;
export declare const E_UNDEFINED_RELATIONSHIP: new (args?: any, options?: ErrorOptions) => Exception;
export declare const E_RUNTIME_EXCEPTION: new (args?: any, options?: ErrorOptions) => Exception;
/**
 * The client is not supported by Lucid
 */
export declare const E_UNSUPPORTED_CLIENT: new (args: [string], options?: ErrorOptions) => Exception;
