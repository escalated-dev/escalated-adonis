export type ImportInfo = {
    source: string;
    defaultImport?: string;
    defaultTypeImport?: string;
    namedImports?: string[];
    typeImports?: string[];
};
/**
 * ImportsBag manages and deduplicates imports from the same source
 */
export declare class ImportsBag {
    #private;
    /**
     * Add an import to the bag
     */
    add(importInfo: ImportInfo): this;
    /**
     * Get deduplicated imports as an array
     */
    toArray(): ImportInfo[];
    /**
     * Get deduplicated imports as a formatted string
     */
    toString(): string;
}
