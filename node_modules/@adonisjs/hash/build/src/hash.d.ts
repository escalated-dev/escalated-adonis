import type { HashDriverContract } from './types.js';
/**
 * Hash and verify values using a dedicated hash driver. The Hash
 * works as an adapter across different drivers.
 *
 * ```ts
 * const hash = new Hash(new Argon())
 * const hashedPassword = await hash.make('secret')
 *
 * const isValid = await hash.verify(hashedPassword, 'secret')
 * console.log(isValid)
 * ```
 */
export declare class Hash implements HashDriverContract {
    #private;
    constructor(driver: HashDriverContract);
    /**
     * Check if the value is a valid hash. This method just checks
     * for the formatting of the hash
     */
    isValidHash(value: string): boolean;
    /**
     * Hash plain text value
     */
    make(value: string): Promise<string>;
    /**
     * Verify the plain text value against an existing hash
     */
    verify(hashedValue: string, plainValue: string): Promise<boolean>;
    /**
     * Find if the hash value needs a rehash or not.
     */
    needsReHash(hashedValue: string): boolean;
    /**
     * Assert the plain value passes the hash verification
     */
    assertEquals(hashedValue: string, plainValue: string): Promise<void>;
    /**
     * Assert the plain value fails the hash verification
     */
    assertNotEquals(hashedValue: string, plainValue: string): Promise<void>;
}
