import { Qs } from '../src/qs.js';
import type { QSParserConfig } from '../src/types/qs.js';
/**
 * QS Parser factory is used to generate the query string
 * parser for testing
 */
export declare class QsParserFactory {
    #private;
    /**
     * Merge encryption factory options
     */
    merge(options: Partial<{
        parse: Partial<QSParserConfig['parse']>;
        stringify: Partial<QSParserConfig['stringify']>;
    }>): this;
    /**
     * Create instance of the logger class
     */
    create(): Qs;
}
