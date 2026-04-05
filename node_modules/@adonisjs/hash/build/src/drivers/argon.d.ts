import type { ArgonConfig, HashDriverContract } from '../types.js';
/**
 * Hash driver built on top of "argon2" hash algorigthm. Under the hood
 * we make use of the "argon2" npm package.
 *
 * The Argon implementation uses the PHC formatting for creating
 * and verifying hashes.
 *
 * ```ts
 * const argon = new Argon({})
 *
 * await argon.make('secret')
 * // $argon2id$v=19$t=3,m=4096,p=1$drxJBWzWahR5tMubp+a1Sw$L/Oh2uw6QKW77i/KQ8eGuOt3ui52hEmmKlu1KBVBxiM
 * ```
 */
export declare class Argon implements HashDriverContract {
    #private;
    constructor(config: ArgonConfig);
    /**
     * Check if the value is a valid hash. This method just checks
     * for the formatting of the hash.
     *
     * ```ts
     * argon.isValidHash('hello world') // false
     * argon.isValidHash('$argon2id$v=19$t=3,m=4096,p=1$drxJBWzWahR5tMubp+a1Sw$L/Oh2uw6QKW77i/KQ8eGuOt3ui52hEmmKlu1KBVBxiM')
     * ```
     */
    isValidHash(value: string): boolean;
    /**
     * Hash a plain text value
     *
     * ```ts
     * const hash = await argon.make('password')
     * ```
     */
    make(value: string): Promise<string>;
    /**
     * Verify the plain text value against an existing hash
     *
     * ```ts
     * if (await argon.verify(hash, plainText)) {
     *
     * }
     * ```
     */
    verify(hashedValue: string, plainValue: string): Promise<boolean>;
    /**
     * Find if the hash value needs a rehash or not. The rehash is
     * required when.
     *
     * 1. The argon2 version is changed
     * 2. Number of iterations are changed
     * 3. The memory value is changed
     * 4. The parellelism value is changed
     * 5. The argon variant is changed
     * 6. The provided hash has not been hashed with argon
     *
     * ```ts
     * const isValid = await argon.verify(hash, plainText)
     *
     * // Plain password is valid and hash needs a rehash
     * if (isValid && await argon.needsReHash(hash)) {
     *   const newHash = await argon.make(plainText)
     * }
     * ```
     */
    needsReHash(value: string): boolean;
}
