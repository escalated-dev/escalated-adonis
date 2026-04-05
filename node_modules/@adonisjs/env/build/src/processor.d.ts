/**
 * Env processors loads, parses and process environment variables.
 */
export declare class EnvProcessor {
    #private;
    constructor(appRoot: URL);
    /**
     * Process env variables
     */
    process(): Promise<Record<string, any>>;
}
