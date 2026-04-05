/**
 * Summary builder is used to create the tests summary reported by
 * multiple reporters. Each report contains a key-value pair
 */
export declare class SummaryBuilder {
    #private;
    /**
     * Register a custom summary reporter
     */
    use(reporter: () => {
        key: string;
        value: string | string[];
    }[]): this;
    /**
     * Builds the summary table
     */
    build(): string[];
}
