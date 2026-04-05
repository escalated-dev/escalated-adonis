import type { Encryption } from '@adonisjs/encryption';
/**
 * Cookie parser parses the HTTP `cookie` header and collects all cookies
 * inside an object of `key-value` pair, but doesn't attempt to decrypt
 * or unsign or decode the individual values.
 *
 * The cookie values are lazily decrypted, or unsigned to avoid unncessary
 * processing, which infact can be used as a means to burden the server
 * by sending too many cookies which even doesn't belongs to the
 * server.
 */
export declare class CookieParser {
    #private;
    constructor(cookieHeader: string, encryption: Encryption);
    /**
     * Attempts to decode a cookie by the name. When calling this method,
     * you are assuming that the cookie was just encoded in the first
     * place and not signed or encrypted.
     */
    decode(key: string, encoded?: boolean): any | null;
    /**
     * Attempts to unsign a cookie by the name. When calling this method,
     * you are assuming that the cookie was signed in the first place.
     */
    unsign(key: string): null | any;
    /**
     * Attempts to decrypt a cookie by the name. When calling this method,
     * you are assuming that the cookie was encrypted in the first place.
     */
    decrypt(key: string): null | any;
    /**
     * Returns an object of cookies key-value pair. Do note, the
     * cookies are not decoded, unsigned or decrypted inside this
     * list.
     */
    list(): Record<string, any>;
}
