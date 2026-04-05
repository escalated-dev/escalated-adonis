import type { Colors } from '@poppinss/colors/types';
import { type Task } from '../task.js';
import type { RendererContract } from '../../types.js';
/**
 * Raw renderer shows a detailed output of the tasks without using any
 * ansi characters
 */
export declare class RawRenderer {
    #private;
    constructor();
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
     * Register tasks to render
     */
    tasks(tasks: Task[]): this;
    /**
     * Render all tasks
     */
    render(): void;
}
