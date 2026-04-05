import { Exception } from '@poppinss/utils';
/**
 * Exception raised when one or more env variables
 * are invalid
 */
export declare const E_INVALID_ENV_VARIABLES: {
    new (message?: string, options?: ErrorOptions & {
        code?: string;
        status?: number;
    }): {
        help: string;
        name: string;
        code?: string;
        status: number;
        toString(): string;
        readonly [Symbol.toStringTag]: string;
        message: string;
        stack?: string;
        cause?: unknown;
    };
    message: string;
    code: string;
    help?: string;
    status?: number;
    captureStackTrace(targetObject: object, constructorOpt?: Function): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export declare const E_IDENTIFIER_ALREADY_DEFINED: new (args: [string], options?: ErrorOptions) => Exception;
