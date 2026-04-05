import { BaseReporter } from '../../modules/core/main.js';
import type { TestEndNode, SuiteEndNode, GroupEndNode, SuiteStartNode, GroupStartNode } from '../../modules/core/types.js';
/**
 * Prints tests progress as JSON. Each event is emitted
 * independently
 */
export declare class NdJSONReporter extends BaseReporter {
    #private;
    protected onTestEnd(payload: TestEndNode): void;
    protected onGroupStart(payload: GroupStartNode): void;
    protected onGroupEnd(payload: GroupEndNode): void;
    protected onSuiteStart(payload: SuiteStartNode): void;
    protected onSuiteEnd(payload: SuiteEndNode): void;
    protected end(): Promise<void>;
}
