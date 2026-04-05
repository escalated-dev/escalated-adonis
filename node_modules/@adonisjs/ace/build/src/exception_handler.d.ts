import { Kernel } from '../index.js';
/**
 * The base exception handler that is used by default to exception
 * ace exceptions.
 *
 * You can extend this class to custom the exception rendering
 * behavior.
 */
export declare class ExceptionHandler {
    debug: boolean;
    /**
     * Known error codes. For these error, only the error message is
     * reported using the logger
     */
    protected knownErrorCodes: string[];
    /**
     * Internal set of known error codes.
     */
    protected internalKnownErrorCode: string[];
    /**
     * Logs error to stderr using logger
     */
    protected logError(error: {
        message: any;
    } & unknown, kernel: Kernel<any>): void;
    /**
     * Pretty prints uncaught error in debug mode
     */
    protected prettyPrintError(error: object): Promise<void>;
    /**
     * Renders an exception for the console
     */
    render(error: unknown, kernel: Kernel<any>): Promise<any>;
}
