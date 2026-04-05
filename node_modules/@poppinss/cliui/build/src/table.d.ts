import type { Colors } from '@poppinss/colors/types';
import type { RendererContract, TableHead, TableOptions, TableRow } from './types.js';
/**
 * Exposes the API to represent a table
 */
export declare class Table {
    #private;
    constructor(options?: Partial<TableOptions>);
    /**
     * Returns the renderer for rendering the messages
     */
    getRenderer(): RendererContract;
    /**
     * Define a custom renderer. Logs to "stdout" and "stderr"
     * by default
     */
    useRenderer(renderer: RendererContract): this;
    /**
     * Returns the colors implementation in use
     */
    getColors(): Colors;
    /**
     * Define a custom colors implementation
     */
    useColors(color: Colors): this;
    /**
     * Define table head
     */
    head(headColumns: TableHead): this;
    /**
     * Add a new table row
     */
    row(row: TableRow): this;
    /**
     * Define custom column widths
     */
    columnWidths(widths: number[]): this;
    /**
     * Toggle whether or render in full width or not
     */
    fullWidth(renderFullWidth?: boolean): this;
    /**
     * Define the column index that should take
     * will remaining width when rendering in
     * full-width
     */
    fluidColumnIndex(index: number): this;
    /**
     * Render table
     */
    render(): void;
}
