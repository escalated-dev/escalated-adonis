/**
 * Key normalizer normalizes the key for writing and reading files. It
 * removes unsafe characters from a string that are either not allowed
 * by cloud providers, or can conflict with a URL.
 *
 * The keys are also scanned and protected from path traversal.
 */
export declare class KeyNormalizer {
    #private;
    /**
     * The set of allowed characters. Key free to re-assign a new
     * value
     */
    static allowedCharacterSet: RegExp;
    /**
     * Normalize the key
     */
    normalize(key: string): string;
}
