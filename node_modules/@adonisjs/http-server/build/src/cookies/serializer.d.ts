import type { Encryption } from '@adonisjs/encryption';
import type { CookieOptions } from '../types/response.js';
/**
 * Cookies serializer is used to serialize a value to be set on the `Set-Cookie`
 * header. You can `encode`, `sign` on `encrypt` cookies using the serializer
 * and then set them individually using the `set-cookie` header.
 */
export declare class CookieSerializer {
    #private;
    constructor(encryption: Encryption);
    /**
     * Encodes value as a plain cookie. By default, the plain value will be converted
     * to a string using "JSON.stringify" method and then encoded as a base64 string.
     *
     * You can disable encoding of the cookie by setting `options.encoded = false`.
     *
     * ```ts
     *  serializer.encode('name', 'virk')
     * ```
     */
    encode(key: string, value: any, options?: Partial<CookieOptions & {
        encode: boolean;
    }>): string | null;
    /**
     * Sign a key-value pair to a signed cookie. The signed value has a
     * verification hash attached to it to detect data tampering.
     */
    sign(key: string, value: any, options?: Partial<CookieOptions>): string | null;
    /**
     * Encrypts a key-value pair to an encrypted cookie.
     */
    encrypt(key: string, value: any, options?: Partial<CookieOptions>): string | null;
}
