/**
 * Encodes a Buffer to base64 using the bcrypt's base64 dictionary.
 * @param {Buffer} buff Buffer to encode.
 * @returns {string} The buffer encoded as a string.
 */
export function encode(buff: Buffer): string;
/**
 * Decodes a base64 encoded string using the bcrypt's base64 dictionary.
 * @param {string} str String to decode.
 * @returns {Buffer} The string decoded as a Buffer.
 * @inner
 */
export function decode(str: string): Buffer;
