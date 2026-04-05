import type { ProviderNode, AppEnvironments } from '../types.js';
/**
 * The ProvidersManager class is used to resolve, import and execute lifecycle
 * methods on registered providers.
 *
 * The class relies on "import.meta.resolve" to resolve the provider modules from
 * the root of the application.
 *
 * Also, a single instance of the provider is used to executed all the hooks.
 */
export declare class ProvidersManager {
    #private;
    constructor(options: {
        environment: AppEnvironments;
        providersState: any[];
    });
    /**
     * Pass an array of providers to use
     */
    use(list: ProviderNode[]): this;
    /**
     * Switch the environment in which the app is running.
     */
    setEnvironment(environment: AppEnvironments): this;
    /**
     * Invoke register method on the providers.
     */
    register(): Promise<void>;
    /**
     * Invoke boot method on the providers. The existing providers
     * instances are used.
     */
    boot(): Promise<void>;
    /**
     * Invoke start method on all the providers
     */
    start(): Promise<void>;
    /**
     * Invoke ready method on all the providers
     */
    ready(): Promise<void>;
    /**
     * Invoke shutdown method on all the providers
     */
    shutdown(inReverseOrder: boolean): Promise<void>;
}
