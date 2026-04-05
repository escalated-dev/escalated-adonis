import { Encryption } from '../src/encryption.js';
import type { EncryptionOptions } from '../src/types.js';
/**
 * Encryption factory is used to generate encryption class instances for
 * testing
 */
export declare class EncryptionFactory {
    #private;
    /**
     * Merge encryption factory options
     */
    merge(options: Partial<EncryptionOptions>): this;
    /**
     * Create instance of encryption class
     */
    create(): Encryption;
}
