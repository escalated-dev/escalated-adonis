import type { ListTable } from '../types.js';
/**
 * The list formatter formats the list of commands and flags. The option column
 * is justified to have same width accross all the rows.
 */
export declare class ListFormatter {
    #private;
    constructor(tables: ListTable[]);
    /**
     * Format tables list into an array of rows
     */
    format(terminalWidth?: number): {
        heading: string;
        rows: string[];
    }[];
}
