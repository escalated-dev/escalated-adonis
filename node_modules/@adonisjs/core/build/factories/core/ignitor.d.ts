import { Ignitor } from '../../src/ignitor/main.js';
import type { ApplicationService, IgnitorOptions } from '../../src/types.js';
type FactoryParameters = {
    rcFileContents: Record<string, any>;
    config: Record<string, any>;
};
/**
 * Ignitor factory creates an instance of the AdonisJS ignitor
 */
export declare class IgnitorFactory {
    #private;
    /**
     * Define preload actions to run.
     */
    preload(action: (app: ApplicationService) => void | Promise<void>): this;
    /**
     * Merge custom factory parameters
     */
    merge(params: Partial<FactoryParameters>): this;
    /**
     * Load core provider when booting the app
     */
    withCoreProviders(): this;
    /**
     * Merge default config for the core features. A shallow merge
     * is performed.
     */
    withCoreConfig(): this;
    /**
     * Create ignitor instance
     */
    create(appRoot: URL, options?: IgnitorOptions): Ignitor;
}
export {};
