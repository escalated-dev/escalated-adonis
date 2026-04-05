/**
 * Default implementation
 */
declare const defaultGenerator: (size: number) => string;
/**
 * Generates a URL safe random string of a given size
 */
export declare function random(size: number): string;
export declare namespace random {
    var use: (generator: typeof defaultGenerator) => void;
    var restore: () => void;
}
export {};
