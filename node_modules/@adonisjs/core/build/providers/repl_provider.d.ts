import type { ApplicationService } from '../src/types.js';
export default class ReplServiceProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    /**
     * Registers the REPL binding
     */
    register(): void;
    /**
     * Registering REPL bindings during provider boot
     */
    boot(): Promise<void>;
}
