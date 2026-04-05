import { Hash } from './hash.js';
import type { HashDriverContract, ManagerDriverFactory } from './types.js';
/**
 * HashManager implements the manager/builder pattern to create a use multiple
 * hashing algorithm without self managing hash instance.
 *
 * ```ts
 * const manager = new HashManager({
 *   default: 'argon',
 *   list: {
 *     argon: () => new ArgonDriver(),
 *     bcrypt: () => new BcryptDriver(),
 *   }
 * })
 * ```
 */
export declare class HashManager<KnownHashers extends Record<string, ManagerDriverFactory>> implements HashDriverContract {
    #private;
    config: {
        default?: keyof KnownHashers;
        list: KnownHashers;
    };
    constructor(config: {
        default?: keyof KnownHashers;
        list: KnownHashers;
    });
    /**
     * Use one of the registered hashers to hash values.
     *
     * ```ts
     * manager.use() // returns default hasher
     * manager.use('argon')
     * ```
     */
    use<Hasher extends keyof KnownHashers>(hasher?: Hasher): Hash;
    /**
     * Fake hash drivers to disable hashing values
     */
    fake(): void;
    /**
     * Restore fake
     */
    restore(): void;
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
