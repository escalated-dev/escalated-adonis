import { type ScryptOptions } from 'node:crypto';
export declare const MAX_UINT32: number;
export declare const MAX_UINT24: number;
/**
 * Validates a number to be within a given range.
 */
export declare class RangeValidator {
    static validate(label: string, value: unknown, range: [number, number]): void;
}
/**
 * Validates a value to be one of the allowed values
 */
export declare class EnumValidator {
    static validate(label: string, value: unknown, allowedValues: any[]): void;
}
/**
 * Async function to generate random bytes
 */
export declare const randomBytesAsync: (arg1: number) => Promise<Buffer<ArrayBufferLike>>;
/**
 * Async version of scrypt.
 */
export declare const scryptAsync: (arg1: string, arg2: Buffer<ArrayBufferLike>, arg3: number, arg4: ScryptOptions) => Promise<Buffer<ArrayBufferLike>>;
