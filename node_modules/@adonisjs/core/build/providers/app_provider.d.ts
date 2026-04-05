import type { ApplicationService } from '../src/types.js';
/**
 * The Application Service provider registers all the baseline
 * features required to run the framework.
 */
export default class AppServiceProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    /**
     * Registers test utils with the container
     */
    protected registerTestUtils(): void;
    /**
     * Registers ace with the container
     */
    protected registerAce(): void;
    /**
     * Registers the application to the container
     */
    protected registerApp(): void;
    /**
     * Registers the logger class to resolve the default logger
     */
    protected registerLogger(): void;
    /**
     * Registers the logger manager to the container
     */
    protected registerLoggerManager(): void;
    /**
     * Registers the config to the container
     */
    protected registerConfig(): void;
    /**
     * Registers emitter service to the container
     */
    protected registerEmitter(): void;
    /**
     * Register the encryption service to the container
     */
    protected registerEncryption(): void;
    /**
     * Registers the HTTP server with the container as a singleton
     */
    protected registerServer(): void;
    /**
     * Registers router with the container as a singleton
     */
    protected registerRouter(): void;
    /**
     * Self construct bodyparser middleware class, since it needs
     * config that cannot be resolved by the container
     */
    protected registerBodyParserMiddleware(): void;
    /**
     * Registeres singleton instance of the "Dumper" module configured
     * via the "config/app.ts" file.
     */
    protected registerDumper(): void;
    /**
     * Registers bindings
     */
    register(): void;
    boot(): Promise<void>;
}
