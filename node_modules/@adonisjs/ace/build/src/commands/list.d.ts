import { BaseCommand } from './base.js';
import type { CommandMetaData } from '../types.js';
/**
 * The list command is used to view a list of commands
 */
export declare class ListCommand extends BaseCommand {
    #private;
    /**
     * Command metadata
     */
    static commandName: string;
    static description: string;
    static help: string[];
    /**
     * Optional flag to filter list by namespace
     */
    namespaces?: string[];
    json?: boolean;
    /**
     * The method is used to render a list of options and commands
     */
    protected renderList(): void;
    protected renderToJSON(): CommandMetaData[];
    /**
     * Executed by ace directly
     */
    run(): Promise<void>;
}
