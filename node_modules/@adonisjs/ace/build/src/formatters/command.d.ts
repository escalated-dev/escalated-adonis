import type { AllowedInfoValues, CommandMetaData, UIPrimitives } from '../types.js';
/**
 * The command formatter exposes API to format command data for the
 * commands list and the command help.
 */
export declare class CommandFormatter {
    #private;
    constructor(command: CommandMetaData, colors: UIPrimitives['colors']);
    /**
     * Returns the formatted command name to be displayed in the list
     * of commands
     */
    formatListName(aliases: string[]): string;
    /**
     * Returns the formatted description of the command
     */
    formatDescription(): string;
    /**
     * Returns multiline command help
     */
    formatHelp(binaryName?: AllowedInfoValues, terminalWidth?: number): string;
    /**
     * Returns the formatted description to be displayed in the list
     * of commands
     */
    formatListDescription(): string;
    /**
     * Returns an array of strings, each line contains an individual usage
     */
    formatUsage(aliases: string[], binaryName?: AllowedInfoValues): string[];
}
