/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import he from 'he';
import prettyHrTime from 'pretty-hrtime';
import string from '@poppinss/utils/string';
import StringBuilder from '@poppinss/utils/string_builder';
/**
 * Collection of string helpers to transform a string value.
 */
const stringHelpers = {
    ...string,
    toSentence: string.sentence,
    ordinalize: string.ordinal,
    generateRandom: string.random,
    create(value) {
        return new StringBuilder(value);
    },
    prettyHrTime(time, options) {
        return prettyHrTime(time, options);
    },
    isEmpty(value) {
        return value.trim().length === 0;
    },
    escapeHTML(value, options) {
        value = he.escape(value);
        if (options && options.encodeSymbols) {
            value = this.encodeSymbols(value, { allowUnsafeSymbols: true });
        }
        return value;
    },
    encodeSymbols(value, options) {
        return he.encode(value, options);
    },
};
export default stringHelpers;
