import type { Colors } from '@poppinss/colors/types';
import type { RendererContract, StepsOptions } from './types.js';
/**
 * Steps class is used to display a series of sequential steps
 * with counters, titles, content, and a visual left border
 * connecting them.
 *
 * ```ts
 * const steps = ui.steps()
 *
 * steps.add('Install dependencies', 'Run npm install to get started')
 * steps.add('Configure app', 'Create a .env file with your settings')
 * steps.add('Start server', 'Use npm start to launch the application')
 *
 * steps.render()
 * ```
 */
export declare class Steps {
    #private;
    constructor(options?: Partial<StepsOptions>);
    /**
     * Returns the renderer to use for output.
     * Defaults to ConsoleRenderer if not explicitly set
     */
    getRenderer(): RendererContract;
    /**
     * Define a custom renderer to use
     */
    useRenderer(renderer: RendererContract): this;
    /**
     * Returns the colors instance
     */
    getColors(): Colors;
    /**
     * Define a custom colors instance
     */
    useColors(colors: Colors): this;
    /**
     * Add a new step to the collection
     *
     * @param title - The step title/heading
     * @param content - Optional content/description for the step (supports ANSI formatting)
     */
    add(title: string, content?: string): this;
    /**
     * Prepare the formatted output without rendering.
     * Useful for testing or custom output handling.
     */
    prepare(): string;
    /**
     * Render the steps to the configured renderer
     */
    render(): void;
}
