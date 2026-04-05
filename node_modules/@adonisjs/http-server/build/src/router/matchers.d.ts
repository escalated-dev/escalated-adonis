import Macroable from '@poppinss/macroable';
/**
 * Shortcut methods for commonly used route matchers
 */
export declare class RouteMatchers extends Macroable {
    /**
     * Enforce value to be a number and also casts it to number data
     * type
     */
    number(): {
        match: RegExp;
        cast: (value: string) => number;
    };
    /**
     * Enforce value to be formatted as uuid
     */
    uuid(): {
        match: RegExp;
        cast: (value: string) => string;
    };
    /**
     * Enforce value to be formatted as slug
     */
    slug(): {
        match: RegExp;
    };
}
