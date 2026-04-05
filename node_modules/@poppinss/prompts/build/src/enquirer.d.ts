import { BasePrompt } from './base.js';
/**
 * Uses the `enquirer` package to prompt user for input. The `$prompt`
 * method is invoked by the extended `Prompt` class.
 */
export declare class Prompt extends BasePrompt {
    protected prompt(options: any): Promise<any>;
}
