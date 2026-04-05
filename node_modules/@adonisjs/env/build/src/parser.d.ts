import { DotenvParseOutput } from 'dotenv';
/**
 * Env parser parses the environment variables from a string formatted
 * as a key-value pair seperated using an `=`. For example:
 *
 * ```dotenv
 * PORT=3333
 * HOST=127.0.0.1
 * ```
 *
 * The variables can reference other environment variables as well using `$`.
 * For example:
 *
 * ```dotenv
 * PORT=3333
 * REDIS_PORT=$PORT
 * ```
 *
 * The variables using characters other than letters can wrap variable
 * named inside a curly brace.
 *
 * ```dotenv
 * APP-PORT=3333
 * REDIS_PORT=${APP-PORT}
 * ```
 *
 * You can escape the `$` sign with a backtick.
 *
 * ```dotenv
 * REDIS_PASSWORD=foo\$123
 * ```
 *
 * ## Usage
 *
 * ```ts
 * const parser = new EnvParser(envContents)
 * const output = parser.parse()
 *
 * // The output is a key-value pair
 * ```
 */
export declare class EnvParser {
    #private;
    constructor(envContents: string, options?: {
        ignoreProcessEnv: boolean;
    });
    /**
     * Define an identifier for any environment value. The callback is invoked
     * when the value match the identifier to modify its interpolation.
     *
     * @deprecated use `EnvParser.defineIdentifier` instead
     */
    static identifier(name: string, callback: (value: string) => Promise<string> | string): void;
    /**
     * Define an identifier for any environment value. The callback is invoked
     * when the value match the identifier to modify its interpolation.
     */
    static defineIdentifier(name: string, callback: (value: string) => Promise<string> | string): void;
    /**
     * Define an identifier for any environment value, if it's not already defined.
     * The callback is invoked when the value match the identifier to modify its
     * interpolation.
     */
    static defineIdentifierIfMissing(name: string, callback: (value: string) => Promise<string> | string): void;
    /**
     * Remove an identifier
     */
    static removeIdentifier(name: string): void;
    /**
     * Parse the env string to an object of environment variables.
     */
    parse(): Promise<DotenvParseOutput>;
}
