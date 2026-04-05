import { inspect } from 'node:util';
import type { Kernel } from '@adonisjs/core/ace';
import { Exception } from '@poppinss/utils/exception';
import type { HttpContext } from '@adonisjs/core/http';
import type { Dumper } from './dumper.js';
/**
 * DumpDie exception is raised by the "dd" function. It will
 * result in dumping the value in response to an HTTP
 * request or printing the value to the console
 */
declare class DumpDieException extends Exception {
    #private;
    static status: number;
    static code: string;
    fileName: string;
    lineNumber: number;
    value: unknown;
    constructor(value: unknown, dumper: Dumper);
    /**
     * Set the index for the trace source. This is helpful when
     * you build nested helpers on top of Die/Dump
     */
    setTraceSourceIndex(index: number): this;
    /**
     * Preventing itself from getting reported by the
     * AdonisJS exception reporter
     */
    report(): void;
    /**
     * Handler called by the AdonisJS HTTP exception handler
     */
    handle(error: DumpDieException, ctx: HttpContext): Promise<void>;
    /**
     * Handler called by the AdonisJS Ace kernel
     */
    render(error: DumpDieException, kernel: Kernel): Promise<void>;
    /**
     * Custom output for the Node.js util inspect
     */
    [inspect.custom](): string;
}
export declare const E_DUMP_DIE_EXCEPTION: typeof DumpDieException;
export {};
