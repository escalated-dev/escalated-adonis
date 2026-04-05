import { Application } from '../src/application.js';
import type { AppEnvironments, Importer } from '../src/types.js';
/**
 * App factory is used to generate application class instances for
 * testing
 */
export declare class AppFactory<ContainerBindings extends Record<any, any>> {
    #private;
    /**
     * Merge parameters accepted by the AppFactory
     */
    merge(params: Partial<{
        environment: AppEnvironments;
        importer: Importer;
    }>): this;
    /**
     * Create application class instance
     */
    create(appRoot: URL, importer?: Importer): Application<ContainerBindings>;
}
