import { AssertionError } from 'node:assert';
import { type PromptChoice, type ListPromptOptions, type TextPromptOptions, type TogglePromptOptions, type ChoicePromptOptions, type BooleanPromptOptions, type MultiplePromptOptions, type AutoCompletePromptOptions } from './types.js';
import { MockedPrompt } from './mocked_prompt.js';
/**
 * Base prompt class exposes the public API for triggering prompts. The
 * implementations just need to implement a single prompt method.
 */
export declare abstract class BasePrompt {
    #private;
    traps: {
        prompts: Map<string, {
            prompt: MockedPrompt;
            triggerError: AssertionError;
        }>;
        verify: () => void;
    };
    protected abstract prompt(options: any): Promise<any>;
    /**
     * Prompts for text input
     */
    ask<Result extends any = string>(title: string, options?: TextPromptOptions<Result>): Promise<Result>;
    /**
     * Prompt to accept a list of comma separated values
     */
    list<Result extends any = string[]>(title: string, options?: ListPromptOptions<Result>): Promise<Result>;
    /**
     * Prompts for text input but masks the output (for password)
     */
    secure<Result extends any = string>(title: string, options?: TextPromptOptions<Result>): Promise<Result>;
    /**
     * Asks for `Y/n`
     */
    confirm<Result extends any = boolean>(title: string, options?: BooleanPromptOptions<Result>): Promise<Result>;
    /**
     * Similar to [[this.confirm]] but with custom names for the `Y/n` options
     */
    toggle<Result extends any = boolean>(title: string, choices: [string, string], options?: TogglePromptOptions<Result>): Promise<Result>;
    /**
     * Prompt to select a value from the list of options
     */
    choice<Choice extends string, Result extends any = Choice>(title: string, choices: readonly (Choice | PromptChoice<Choice>)[], options?: ChoicePromptOptions<Choice, Result>): Promise<Result>;
    /**
     * Prompt to select multiple values from the list of options
     */
    multiple<Choice extends string, Result extends any = Choice[]>(title: string, choices: readonly (Choice | PromptChoice<Choice>)[], options?: MultiplePromptOptions<Choice, Result>): Promise<Result>;
    /**
     * Prompt to select one or multiple values from the list of searchable
     * options.
     */
    autocomplete<Choice extends string, Multiple extends boolean = false, Result extends any = Multiple extends true ? Choice[] : Choice>(title: string, choices: readonly Choice[], options?: AutoCompletePromptOptions<Choice, Multiple, Result>): Promise<Result>;
    /**
     * Trap a prompt by its message or unique name
     */
    trap(message: string): MockedPrompt;
}
