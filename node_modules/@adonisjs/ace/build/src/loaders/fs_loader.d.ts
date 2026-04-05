import type { AbstractBaseCommand, CommandMetaData, LoadersContract } from '../types.js';
/**
 * Fs loader exposes the API to load commands from a directory. All files
 * ending with ".js", ".cjs", ".mjs", ".ts" and ".mts" are considered
 * as commands
 */
export declare class FsLoader<Command extends AbstractBaseCommand> implements LoadersContract<Command> {
    #private;
    constructor(comandsDirectory: string, filter?: (filePath: string) => boolean);
    /**
     * Returns the metadata of commands
     */
    getMetaData(): Promise<CommandMetaData[]>;
    /**
     * Returns the command class constructor for a given command. Null
     * is returned when unable to lookup the command
     */
    getCommand(metaData: CommandMetaData): Promise<Command | null>;
}
