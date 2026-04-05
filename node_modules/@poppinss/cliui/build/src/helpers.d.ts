/**
 * Total number of columns for the terminal
 */
export declare const TERMINAL_SIZE: number;
/**
 * Justify the columns to have the same width by filling
 * the empty slots with a padding char.
 *
 * Optionally, the column can be aligned left or right.
 */
export declare function justify(columns: string[], options: {
    maxWidth: number;
    align?: 'left' | 'right';
    paddingChar?: string;
}): string[];
/**
 * Wrap the text under the starting and the ending column.
 * The first line will start at 1st column. However, from
 * the 2nd line onwards, the columns before the start
 * column are filled with white space.
 */
export declare function wrap(columns: string[], options: {
    startColumn: number;
    endColumn: number;
    trimStart?: boolean;
}): string[];
/**
 * Truncates the text after a certain width.
 */
export declare function truncate(columns: string[], options: {
    maxWidth: number;
    truncationChar?: string;
    position?: 'start' | 'middle' | 'end';
}): string[];
