import type { CLIArgs } from './types.js';
/**
 * CLI Parser is used to parse the commandline argument
 */
export declare class CliParser {
    /**
     * Parses command-line arguments
     */
    parse(argv: string[]): CLIArgs;
    /**
     * Returns the help string
     */
    getHelp(): string;
}
