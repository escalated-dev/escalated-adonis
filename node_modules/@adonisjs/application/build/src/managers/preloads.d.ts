import type { AppEnvironments, PreloadNode } from '../types.js';
/**
 * The PreloadsManager class is used to resolve and import preload modules.
 *
 * The class relies on "import.meta.resolve" to resolve the provider modules from
 * the root of the application.
 */
export declare class PreloadsManager {
    #private;
    constructor(options: {
        environment: AppEnvironments;
    });
    /**
     * Pass an array of preload modules to import
     */
    use(list: PreloadNode[]): this;
    /**
     * Switch the environment in which the app is running.
     */
    setEnvironment(environment: AppEnvironments): this;
    /**
     * Import preload files
     */
    import(): Promise<void>;
}
