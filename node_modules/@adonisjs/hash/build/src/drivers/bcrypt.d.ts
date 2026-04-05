import type { HashDriverContract, BcryptConfig } from '../types.js';
/**
 * Hash driver built on top of "bcrypt" hash algorigthm. Under the hood
 * we make use of the "bcrypt" npm package.
 *
 * The Bcrypt implementation uses the PHC formatting for creating
 * and verifying hashes.
 *
 * ```ts
 * const bcrypt = new Bcrypt({})
 *
 * await bcrypt.make('secret')
 * // $bcrypt$v=98$r=10$Jtxi46WJ26OQ0khsYLLlnw$knXGfuRFsSjXdj88JydPOnUIglvm1S8
 * ```
 */
export declare class Bcrypt implements HashDriverContract {
    #private;
    constructor(config: BcryptConfig);
    /**
     * Check if the value is a valid hash. This method just checks
     * for the formatting of the hash.
     *
     * ```ts
     * bcrypt.isValidHash('hello world') // false
     * bcrypt.isValidHash('$bcrypt$v=98$r=10$Jtxi46WJ26OQ0khsYLLlnw$knXGfuRFsSjXdj88JydPOnUIglvm1S8')
     * ```
     */
    isValidHash(value: string): boolean;
    /**
     * Hash a plain text value
     *
     * ```ts
     * const hash = await bcrypt.make('password')
     * ```
     */
    make(value: string): Promise<string>;
    /**
     * Verify the plain text value against an existing hash
     *
     * ```ts
     * if (await bcrypt.verify(hash, plainText)) {
     *
     * }
     * ```
     */
    verify(hashedValue: string, plainValue: string): Promise<boolean>;
    /**
     * Find if the hash value needs a rehash or not. The rehash is
     * required when.
     *
     * 1. The bcrypt version is changed
     * 2. Number of rounds are changed
     * 3. Bcrypt hash is not using MCF hash format
     * 4. The provided hash has not been hashed with bcrypt
     *
     * ```ts
     * const isValid = await bcrypt.verify(hash, plainText)
     *
     * // Plain password is valid and hash needs a rehash
     * if (isValid && await bcrypt.needsReHash(hash)) {
     *   const newHash = await bcrypt.make(plainText)
     * }
     * ```
     */
    needsReHash(value: string): boolean;
}
