import { BaseCommand } from './base.js';
import type { CommandMetaData } from '../types.js';
/**
 * The Help command is used to view help for a given command
 */
export declare class HelpCommand extends BaseCommand {
    #private;
    /**
     * Command metadata
     */
    static commandName: string;
    static description: string;
    /**
     * The command name argument
     */
    name: string;
    /**
     * Logs command description
     */
    protected renderDescription(command: CommandMetaData): void;
    /**
     * Logs command usage
     */
    protected renderUsage(command: CommandMetaData): void;
    /**
     * Logs commands arguments and options tables
     */
    protected renderList(command: CommandMetaData): void;
    /**
     * Logs command help text
     */
    protected renderHelp(command: CommandMetaData): void;
    /**
     * Executed by ace directly
     */
    run(): Promise<void>;
}
