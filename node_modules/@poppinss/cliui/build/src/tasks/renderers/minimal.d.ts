import type { Colors } from '@poppinss/colors/types';
import { type Task } from '../task.js';
import type { TaskRendererOptions, RendererContract } from '../../types.js';
/**
 * As the name suggests, render tasks in minimal UI for better viewing
 * experience.
 */
export declare class MinimalRenderer {
    #private;
    constructor(options: TaskRendererOptions);
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
