import type { ApplicationService } from '../src/types.js';
/**
 * Registers the passwords hasher with the container
 */
export default class HashServiceProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    /**
     * Registering the hash class to resolve an instance with the
     * default hasher.
     */
    protected registerHash(): void;
    /**
     * Registers the hash manager with the container
     */
    protected registerHashManager(): void;
    /**
     * Registers bindings
     */
    register(): void;
}
