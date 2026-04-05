import { QSParserConfig } from './types/qs.js';
/**
 * Query string parser used to parse and stringify query
 * strings.
 */
export declare class Qs {
    #private;
    constructor(config: QSParserConfig);
    parse(value: string): import("qs").ParsedQs;
    stringify(value: any): string;
}
