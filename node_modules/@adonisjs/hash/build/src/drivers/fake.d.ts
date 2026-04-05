import type { HashDriverContract } from '../types.js';
/**
 * The fake implementation does not generate any hash and
 * performs verification using the plain text equality
 * check.
 *
 * The fake driver is useful for testing.
 */
export declare class Fake implements HashDriverContract {
    /**
     * Always returns true
     */
    isValidHash(_: string): boolean;
    /**
     * Returns the value as it is
     */
    make(value: string): Promise<string>;
    /**
     * Checks the hash and the plain text value using
     * equality check
     */
    verify(hashedValue: string, plainValue: string): Promise<boolean>;
    /**
     * Always returns false
     */
    needsReHash(_: string): boolean;
}
