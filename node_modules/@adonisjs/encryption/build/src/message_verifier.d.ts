/**
 * Message verifier is similar to the encryption. However, the actual payload
 * is not encrypted and just base64 encoded. This is helpful when you are
 * not concerned about the confidentiality of the data, but just want to
 * make sure that is not tampered after encoding.
 */
export declare class MessageVerifier {
    #private;
    constructor(secret: string);
    /**
     * Sign a given piece of value using the app secret. A wide range of
     * data types are supported.
     *
     * - String
     * - Arrays
     * - Objects
     * - Booleans
     * - Numbers
     * - Dates
     *
     * You can optionally define a purpose for which the value was signed and
     * mentioning a different purpose/no purpose during unsign will fail.
     */
    sign(payload: any, expiresIn?: string | number, purpose?: string): string;
    /**
     * Unsign a previously signed value with an optional purpose
     */
    unsign<T extends any>(payload: string, purpose?: string): T | null;
}
