import type { Colors } from '@poppinss/colors/types';
import type { ActionOptions, RendererContract } from '../types.js';
/**
 * Exposes the API to print actions in one of the following three states
 *
 * - failed
 * - succeeded
 * - skipped
 */
export declare class Action {
    #private;
    constructor(message: string, options?: Partial<ActionOptions>);
    /**
     * Returns the renderer for rendering the messages
     */
    getRenderer(): RendererContract;
    /**
     * Define a custom renderer.
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
     * Toggle whether to display duration for completed
     * tasks or not.
     */
    displayDuration(displayDuration?: boolean): this;
    /**
     * Prepares the message to mark action as successful
     */
    prepareSucceeded(): string;
    /**
     * Mark action as successful
     */
    succeeded(): void;
    /**
     * Prepares the message to mark action as skipped
     */
    prepareSkipped(skipReason?: string): string;
    /**
     * Mark action as skipped. An optional skip reason can be
     * supplied
     */
    skipped(skipReason?: string): void;
    /**
     * Prepares the message to mark action as failed
     */
    prepareFailed(error: string | Error): string;
    /**
     * Mark action as failed. An error message is required
     */
    failed(error: string | Error): void;
}
