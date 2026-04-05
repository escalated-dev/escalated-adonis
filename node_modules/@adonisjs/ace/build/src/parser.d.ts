import type { ParsedOutput, FlagsParserOptions, ArgumentsParserOptions } from './types.js';
/**
 * Parses the command line arguments. The flags are parsed
 * using yargs-parser
 */
export declare class Parser {
    #private;
    constructor(options: {
        flagsParserOptions: FlagsParserOptions;
        argumentsParserOptions: ArgumentsParserOptions[];
    });
    /**
     * Parse commandline arguments
     */
    parse(argv: string | string[]): ParsedOutput;
}
