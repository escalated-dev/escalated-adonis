import type { TestEndNode } from '../../modules/core/types.js';
import { BaseReporter } from '../../modules/core/reporters/base.js';
/**
 * Minimal reporter that prints each test as an icon.
 */
export declare class DotReporter extends BaseReporter {
    /**
     * When a test ended
     */
    protected onTestEnd(payload: TestEndNode): void;
    /**
     * When test runner ended
     */
    protected end(): Promise<void>;
}
