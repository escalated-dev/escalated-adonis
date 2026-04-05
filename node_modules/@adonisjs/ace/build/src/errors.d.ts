import { Exception } from '@poppinss/utils';
export declare const E_PROMPT_CANCELLED: new (args?: any, options?: ErrorOptions) => import("@poppinss/exception").Exception;
/**
 * Command is missing the static property command name
 */
export declare const E_MISSING_COMMAND_NAME: new (args: [command: string], options?: ErrorOptions) => Exception;
/**
 * Cannot find a command for the given name
 */
export declare const E_COMMAND_NOT_FOUND: {
    new (args: [command: string]): {
        commandName: string;
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
    help?: string;
    code?: string;
    message?: string;
    isError(error: unknown): error is Error;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]): any;
    stackTraceLimit: number;
};
/**
 * Missing a required flag when running the command
 */
export declare const E_MISSING_FLAG: new (args: [flag: string], options?: ErrorOptions) => Exception;
/**
 * Missing value for a flag that accepts values
 */
export declare const E_MISSING_FLAG_VALUE: new (args: [flag: string], options?: ErrorOptions) => Exception;
/**
 * Missing a required argument when running the command
 */
export declare const E_MISSING_ARG: new (args: [arg: string], options?: ErrorOptions) => Exception;
/**
 * Missing value for an argument
 */
export declare const E_MISSING_ARG_VALUE: new (args: [arg: string], options?: ErrorOptions) => Exception;
/**
 * An unknown flag was mentioned
 */
export declare const E_UNKNOWN_FLAG: new (args: [flag: string], options?: ErrorOptions) => Exception;
/**
 * Invalid value provided for the flag
 */
export declare const E_INVALID_FLAG: new (args: [flag: string, expectedDataType: string], options?: ErrorOptions) => Exception;
