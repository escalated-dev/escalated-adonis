/**
 * Task exposes a very simple API to create tasks with states, along with a
 * listener to listen for the task state updates.
 *
 * The task itself has does not render anything to the console. The task
 * renderers does that.
 */
export declare class Task {
    #private;
    title: string;
    constructor(title: string);
    /**
     * Access the task state
     */
    getState(): "failed" | "idle" | "running" | "succeeded";
    /**
     * Get the time spent in running the task
     */
    getDuration(): string | null;
    /**
     * Get error occurred while running the task
     */
    getError(): string | {
        message: string;
        stack?: string;
    } | null;
    /**
     * Get task completion success message
     */
    getSuccessMessage(): string | null;
    /**
     * Last logged line for the task
     */
    getLastLoggedLine(): string | null;
    /**
     * Bind a listener to listen to the state updates of the task
     */
    onUpdate(listener: (task: this) => void): this;
    /**
     * Start the task
     */
    start(): this;
    /**
     * Update task with log messages. Based upon the renderer
     * in use, it may only display one line at a time.
     */
    update(message: string): this;
    /**
     * Mark task as completed
     */
    markAsSucceeded(message?: string): this;
    /**
     * Mark task as failed
     */
    markAsFailed(error: string | {
        message: string;
        stack?: string;
    }): this;
}
