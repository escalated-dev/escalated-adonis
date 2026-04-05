import { Runner } from '../modules/core/main.js';
import type { NormalizedConfig } from './types.js';
/**
 * Exposes API for working with global hooks
 */
export declare class GlobalHooks {
    #private;
    /**
     * Apply hooks from the config
     */
    apply(config: NormalizedConfig): void;
    /**
     * Perform setup
     */
    setup(runner: Runner): Promise<void>;
    /**
     * Perform cleanup
     */
    teardown(error: Error | null, runner: Runner): Promise<void>;
}
