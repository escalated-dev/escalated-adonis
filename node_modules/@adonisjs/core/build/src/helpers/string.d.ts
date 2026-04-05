import { EncodeOptions } from 'he';
import string from '@poppinss/utils/string';
import StringBuilder from '@poppinss/utils/string_builder';
/**
 * Collection of string helpers to transform a string value.
 */
declare const stringHelpers: typeof string & {
    /**
     * Creates an instance of the string builder
     */
    create(value: string | StringBuilder): StringBuilder;
    ordinalize: (typeof string)['ordinal'];
    /**
     * Convert a string to a sentence
     */
    toSentence: (typeof string)['sentence'];
    /**
     * Generate a random string value of a given length
     */
    generateRandom: (typeof string)['random'];
    /**
     * Pretty print hrtime diff
     */
    prettyHrTime(time: [number, number], options?: {
        verbose?: boolean | undefined;
        precise?: boolean | undefined;
    }): string;
    /**
     * Check if a string is empty.
     */
    isEmpty(value: string): boolean;
    /**
     * Escape HTML entities
     */
    escapeHTML(value: string, options?: {
        encodeSymbols?: boolean;
    }): string;
    /**
     * Encode symbols to html entities
     */
    encodeSymbols(value: string, options?: EncodeOptions): string;
};
export default stringHelpers;
