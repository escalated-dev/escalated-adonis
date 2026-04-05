import type { Colors } from '@poppinss/colors/types';
import { Task } from './task.js';
import type { TaskManagerOptions, TaskCallback, RendererContract } from '../types.js';
/**
 * Exposes the API to create a group of tasks and run them in sequence
 */
export declare class TaskManager {
    #private;
    /**
     * Last handled error
     */
    error?: any;
    constructor(options?: Partial<TaskManagerOptions>);
    /**
     * Access the task state
     */
    getState(): "failed" | "idle" | "running" | "succeeded";
    /**
     * Register a new task
     */
    add(title: string, callback: TaskCallback): this;
    /**
     * Register a new task, when the "conditional = true"
     */
    addIf(conditional: boolean, title: string, callback: TaskCallback): this;
    /**
     * Register a new task, when the "conditional = false"
     */
    addUnless(conditional: boolean, title: string, callback: TaskCallback): this;
    /**
     * Get access to registered tasks
     */
    tasks(): Task[];
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
     * Define a custom colors implementation
     */
    useColors(color: Colors): this;
    /**
     * Run tasks
     */
    run(): Promise<void>;
}
