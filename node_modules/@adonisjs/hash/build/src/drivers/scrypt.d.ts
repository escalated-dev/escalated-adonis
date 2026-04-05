import type { ScryptConfig, HashDriverContract } from '../types.js';
/**
 * Hash driver built on top of "scrypt" hash algorigthm. Under the hood
 * we make use of the Node.js crypto module
 *
 * The Scrypt implementation uses the PHC formatting for creating
 * and verifying hashes.
 *
 * ```ts
 * const scrypt = new Scrypt({})
 *
 * await scrypt.make('secret')
 * // $scrypt$n=16384,r=8,p=1$iILKD1gVSx6bqualYqyLBQ$DNzIISdmTQS6sFdQ1tJ3UCZ7Uun4uGHNjj0x8FHOqB0pf2LYsu9Xaj5MFhHg21qBz8l5q/oxpeV+ZkgTAj+OzQ
 * ```
 */
export declare class Scrypt implements HashDriverContract {
    #private;
    constructor(config: ScryptConfig);
    /**
     * Check if the value is a valid hash. This method just checks
     * for the formatting of the hash.
     *
     * ```ts
     * scrypt.isValidHash('hello world') // false
     * scrypt.isValidHash('$scrypt$n=16384,r=8,p=1$iILKD1gVSx6bqualYqyLBQ$DNzIISdmTQS6sFdQ1tJ3UCZ7Uun4uGHNjj0x8FHOqB0pf2LYsu9Xaj5MFhHg21qBz8l5q/oxpeV+ZkgTAj+OzQ')
     * ```
     */
    isValidHash(value: string): boolean;
    /**
     * Hash a plain text value
     *
     * ```ts
     * const hash = await scrypt.make('password')
     * ```
     */
    make(value: string): Promise<string>;
    /**
     * Verify the plain text value against an existing hash
     *
     * ```ts
     * if (await scrypt.verify(hash, plainText)) {
     *
     * }
     * ```
     */
    verify(hashedValue: string, plainValue: string): Promise<boolean>;
    /**
     * Find if the hash value needs a rehash or not. The rehash is
     * required when.
     *
     * 1. The cost value is changed
     * 2. The blockSize value is changed
     * 3. The parallelization value is changed
     * 4. The provided hash has not been hashed with scrypt
     *
     * ```ts
     * const isValid = await scrypt.verify(hash, plainText)
     *
     * // Plain password is valid and hash needs a rehash
     * if (isValid && await scrypt.needsReHash(hash)) {
     *   const newHash = await scrypt.make(plainText)
     * }
     * ```
     */
    needsReHash(value: string): boolean;
}
