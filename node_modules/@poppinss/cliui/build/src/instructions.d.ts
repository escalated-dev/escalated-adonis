import type { Colors } from '@poppinss/colors/types';
import type { InstructionsOptions, RendererContract } from './types.js';
/**
 * The API to render instructions wrapped inside a box
 */
export declare class Instructions {
    #private;
    constructor(options?: Partial<InstructionsOptions>);
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
     * Draw the instructions box in fullscreen
     */
    fullScreen(): this;
    /**
     * Attach a callback to self draw the borders
     */
    drawBorder(callback: (borderChar: string, colors: Colors) => string): this;
    /**
     * Define heading for instructions
     */
    heading(text: string): this;
    /**
     * Add new instruction. Each instruction is rendered
     * in a new line inside a box
     */
    add(text: string): this;
    prepare(): string;
    /**
     * Render instructions
     */
    render(): void;
}
