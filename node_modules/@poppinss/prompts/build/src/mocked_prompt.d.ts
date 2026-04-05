export declare class MockedPrompt {
    #private;
    constructor();
    /**
     * Reply to prompt with a given answer
     */
    replyWith(answer: string | string[] | boolean | number): this;
    /**
     * Accept the confirmation or the toggle prompt
     */
    accept(): this;
    /**
     * Reject the confirmation or the toggle prompt
     */
    reject(): this;
    /**
     * Choose a select option by index. The index starts with zero
     */
    chooseOption(index: number): this;
    /**
     * Choose multiple options by indexes. The index starts with zero
     */
    chooseOptions(indexes: number[]): this;
    /**
     * Expect the given value to fail the prompt validation
     */
    assertFails(value: string, message?: string | RegExp): this;
    /**
     * Expect the given value to pass the prompt validation
     */
    assertPasses(value: string): this;
    /**
     * Handle the prompt
     */
    handle(options: any): Promise<any>;
}
