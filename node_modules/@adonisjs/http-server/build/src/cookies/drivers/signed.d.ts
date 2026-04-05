import type { Encryption } from '@adonisjs/encryption';
/**
 * Signs a value to be shared as a cookie. The signed output has a
 * hash to verify tampering with the original value
 */
export declare function pack(key: string, value: any, encryption: Encryption): null | string;
/**
 * Returns a boolean, if the unpack method from this module can attempt
 * to unpack the signed value.
 */
export declare function canUnpack(signedValue: string): boolean;
/**
 * Attempts to unpack the signed value. Make sure to call `canUnpack` before
 * calling this method.
 */
export declare function unpack(key: string, signedValue: string, encryption: Encryption): null | any;
