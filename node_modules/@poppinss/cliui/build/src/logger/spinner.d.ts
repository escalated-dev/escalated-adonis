import type { LoggerMessageOptions, RendererContract, SpinnerMessage } from '../types.js';
/**
 * Textual spinner to print a message with dotted progress
 * bar.
 */
export declare class Spinner {
    #private;
    constructor(message: SpinnerMessage);
    /**
     * Returns the renderer for rendering the messages
     */
    getRenderer(): RendererContract;
    /**
     * Define the custom renderer
     */
    useRenderer(renderer: RendererContract): this;
    /**
     * Star the spinner
     */
    start(): this;
    /**
     * Update spinner
     */
    update(text: string, options?: LoggerMessageOptions): this;
    /**
     * Stop spinner
     */
    stop(): void;
    /**
     * Tap into spinner to manually write the
     * output.
     */
    tap(callback: (line: string) => void): this;
}
