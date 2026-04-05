import { uuid } from './src/uuid.ts';
import { random } from './src/random.ts';
import { excerpt } from './src/excerpt.ts';
import { justify } from './src/justify.ts';
import { ordinal } from './src/ordinal.ts';
import { truncate } from './src/truncate.ts';
import { sentence } from './src/sentence.ts';
import { wordWrap } from './src/word_wrap.ts';
import { htmlEscape } from './src/html_escape.ts';
import { interpolate } from './src/interpolate.ts';
import { toUnixSlash } from './src/to_unix_slash.ts';
import { pluralize } from './src/pluralize.ts';
import { noCase, dotCase, dashCase, camelCase, snakeCase, titleCase, pascalCase, capitalCase, sentenceCase } from './src/change_case.ts';
/**
 * Condense multiple whitespaces from a string
 */
declare function condenseWhitespace(value: string): string;
declare const string: {
    excerpt: typeof excerpt;
    truncate: typeof truncate;
    slug: typeof import("slugify").default;
    interpolate: typeof interpolate;
    plural: typeof import("pluralize").plural;
    pluralize: typeof pluralize;
    singular: typeof import("pluralize").singular;
    isPlural: typeof import("pluralize").isPlural;
    isSingular: typeof import("pluralize").isSingular;
    camelCase: typeof camelCase;
    capitalCase: typeof capitalCase;
    dashCase: typeof dashCase;
    dotCase: typeof dotCase;
    noCase: typeof noCase;
    pascalCase: typeof pascalCase;
    sentenceCase: typeof sentenceCase;
    snakeCase: typeof snakeCase;
    titleCase: typeof titleCase;
    random: typeof random;
    sentence: typeof sentence;
    condenseWhitespace: typeof condenseWhitespace;
    wordWrap: typeof wordWrap;
    seconds: {
        format(seconds: number, long?: boolean): import("./src/types.ts").PrettyTime;
        parse(duration: string | number): number;
    };
    milliseconds: {
        format(milliseconds: number, long?: boolean): import("./src/types.ts").PrettyTime;
        parse(duration: string | number): number;
    };
    bytes: {
        format(valueInBytes: number, options?: import("./src/types.ts").BytesOptions): import("./src/types.ts").PrettyBytes | null;
        parse(unit: string | number): number | null;
    };
    ordinal: typeof ordinal;
    htmlEscape: typeof htmlEscape;
    justify: typeof justify;
    uuid: typeof uuid;
    toUnixSlash: typeof toUnixSlash;
};
export default string;
