import type { AbstractBaseCommand, CommandMetaData, LoadersContract } from '../types.js';
/**
 * List loader exposes the API to register commands as classes
 */
export declare class ListLoader<Command extends AbstractBaseCommand> implements LoadersContract<Command> {
    #private;
    constructor(commands: Command[]);
    /**
     * Returns an array of command's metadata
     */
    getMetaData(): Promise<CommandMetaData[]>;
    /**
     * Returns the command class constructor for a given command. Null
     * is returned when unable to lookup the command
     */
    getCommand(metaData: CommandMetaData): Promise<Command | null>;
}
