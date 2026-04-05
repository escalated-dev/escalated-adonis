import { BaseReporter } from '../../modules/core/main.js';
import { GroupStartNode, TestEndNode } from '../../modules/core/types.js';
/**
 * Pretty prints the tests on the console
 */
export declare class SpecReporter extends BaseReporter {
    #private;
    protected onTestStart(): void;
    protected onTestEnd(payload: TestEndNode): void;
    protected onGroupStart(payload: GroupStartNode): void;
    protected onGroupEnd(): void;
    protected end(): Promise<void>;
}
