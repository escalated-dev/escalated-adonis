/**
 * Read the contents of one or more dot-env files. Following is how the files
 * are read.
 *
 * - Load file from the "ENV_PATH" environment file.
 *    (Raise error if file is missing)
 *
 * - If "ENV_PATH" is not defined, then find ".env" file in the app root.
 *    (Ignore if file is missing)
 *
 * - Find ".env.[NODE_ENV]" file in the app root.
 *    (Ignore if file is missing)
 *
 * ```ts
 * const loader = new EnvLoader(new URL('./', import.meta.url))
 *
 * const { envContents, currentEnvContents } = await loader.load()
 *
 * // envContents: Contents of .env or file specified via ENV_PATH
 * // currentEnvContents: Contents of .env.[NODE_ENV] file
 * ```
 */
export declare class EnvLoader {
    #private;
    constructor(appRoot: string | URL, loadExampleFile?: boolean);
    /**
     * Load contents of the main dot-env file and the current
     * environment dot-env file
     */
    load(): Promise<{
        contents: string;
        path: string;
        fileExists: boolean;
    }[]>;
}
