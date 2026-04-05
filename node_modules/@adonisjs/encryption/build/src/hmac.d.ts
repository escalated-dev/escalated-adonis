/// <reference types="node" resolution-mode="require"/>
/**
 * A generic class for generating SHA-256 Hmac for verifying the value
 * integrity.
 */
export declare class Hmac {
    #private;
    constructor(key: Buffer);
    /**
     * Generate the hmac
     */
    generate(value: string): string;
    /**
     * Compare raw value against an existing hmac
     */
    compare(value: string, existingHmac: string): boolean;
}
