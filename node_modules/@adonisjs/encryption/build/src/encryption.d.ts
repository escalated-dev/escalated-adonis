import { base64 } from '@poppinss/utils';
import type { EncryptionOptions } from './types.js';
import { MessageVerifier } from './message_verifier.js';
/**
 * The encryption class allows encrypting and decrypting values using `aes-256-cbc` or `aes-128-cbc`
 * algorithms. The encrypted value uses a unique iv for every encryption and this ensures semantic
 * security (read more https://en.wikipedia.org/wiki/Semantic_security).
 */
export declare class Encryption {
    #private;
    /**
     * Reference to the instance of message verifier for signing
     * and verifying values.
     */
    verifier: MessageVerifier;
    /**
     * Reference to base64 object for base64 encoding/decoding values
     */
    base64: typeof base64;
    /**
     * The algorithm in use
     */
    get algorithm(): 'aes-256-cbc';
    constructor(options: EncryptionOptions);
    /**
     * Encrypt a given piece of value using the app secret. A wide range of
     * data types are supported.
     *
     * - String
     * - Arrays
     * - Objects
     * - Booleans
     * - Numbers
     * - Dates
     *
     * You can optionally define a purpose for which the value was encrypted and
     * mentioning a different purpose/no purpose during decrypt will fail.
     */
    encrypt(payload: any, expiresIn?: string | number, purpose?: string): string;
    /**
     * Decrypt value and verify it against a purpose
     */
    decrypt<T extends any>(value: unknown, purpose?: string): T | null;
    /**
     * Create a children instance with different secret key
     */
    child(options?: EncryptionOptions): Encryption;
}
