import Macroable from '@poppinss/macroable';
import type { Prompt } from '@poppinss/prompts';
import type { Colors } from '@poppinss/cliui/types';
import type { Kernel } from '../kernel.js';
import type { Flag, Argument, ParsedOutput, UIPrimitives, CommandOptions, CommandMetaData, FlagsParserOptions, ArgumentsParserOptions } from '../types.js';
/**
 * The base command sets the foundation for defining ace commands.
 * Every command should inherit from the base command.
 */
export declare class BaseCommand extends Macroable {
    protected kernel: Kernel<any>;
    protected parsed: ParsedOutput;
    ui: UIPrimitives;
    prompt: Prompt;
    static booted: boolean;
    /**
     * Configuration options accepted by the command
     */
    static options: CommandOptions;
    /**
     * A collection of aliases for the command
     */
    static aliases: string[];
    /**
     * The command name one can type to run the command
     */
    static commandName: string;
    /**
     * The command description
     */
    static description: string;
    /**
     * The help text for the command. Help text can be a multiline
     * string explaining the usage of command
     */
    static help?: string | string[];
    /**
     * Registered arguments
     */
    static args: Argument[];
    /**
     * Registered flags
     */
    static flags: Flag[];
    /**
     * Define static properties on the class. During inheritance, certain
     * properties must inherit from the parent.
     */
    static boot(): void;
    /**
     * Specify the argument the command accepts. The arguments via the CLI
     * will be accepted in the same order as they are defined.
     *
     * Mostly, you will be using the `@args` decorator to define the arguments.
     *
     * ```ts
     * Command.defineArgument('entity', { type: 'string' })
     * ```
     */
    static defineArgument(name: string, options: Partial<Argument> & {
        type: 'string' | 'spread';
    }): void;
    /**
     * Specify a flag the command accepts.
     *
     * Mostly, you will be using the `@flags` decorator to define a flag.
     *
     * ```ts
     * Command.defineFlag('connection', { type: 'string', required: true })
     * ```
     */
    static defineFlag(name: string, options: Partial<Flag> & {
        type: 'string' | 'boolean' | 'array' | 'number';
    }): void;
    /**
     * Returns the options for parsing flags and arguments
     */
    static getParserOptions(options?: FlagsParserOptions): {
        flagsParserOptions: Required<FlagsParserOptions>;
        argumentsParserOptions: ArgumentsParserOptions[];
    };
    /**
     * Serializes the command to JSON. The return value satisfies the
     * {@link CommandMetaData}
     */
    static serialize(): CommandMetaData;
    /**
     * Validate the yargs parsed output againts the command.
     */
    static validate(parsedOutput: ParsedOutput): void;
    /**
     * Check if a command has been hypdrated
     */
    protected hydrated: boolean;
    /**
     * The exit code for the command
     */
    exitCode?: number;
    /**
     * The error raised at the time of the executing the command.
     * The value is undefined if no error is raised.
     */
    error?: any;
    /**
     * The result property stores the return value of the "run"
     * method (unless commands sets it explicitly)
     */
    result?: any;
    /**
     * Logger to log messages
     */
    get logger(): import("@poppinss/cliui").Logger;
    /**
     * Add colors to console messages
     */
    get colors(): Colors;
    /**
     * Is the current command the main command executed from the
     * CLI
     */
    get isMain(): boolean;
    /**
     * Reference to the command name
     */
    get commandName(): string;
    /**
     * Reference to the command options
     */
    get options(): CommandOptions;
    /**
     * Reference to the command args
     */
    get args(): Argument[];
    /**
     * Reference to the command flags
     */
    get flags(): Flag[];
    constructor(kernel: Kernel<any>, parsed: ParsedOutput, ui: UIPrimitives, prompt: Prompt);
    /**
     * Hydrate command by setting class properties from
     * the parsed output
     */
    hydrate(): void;
    /**
     * The run method should include the implementation for the
     * command.
     */
    run(..._: any[]): Promise<any>;
    /**
     * Executes the commands by running the command's run method.
     */
    exec(): Promise<any>;
    /**
     * JSON representation of the command
     */
    toJSON(): {
        commandName: string;
        options: CommandOptions;
        args: any[];
        flags: {
            [argName: string]: any;
        };
        error: any;
        result: any;
        exitCode: number | undefined;
    };
    /**
     * Assert the command exists with a given exit code
     */
    assertExitCode(code: number): void;
    /**
     * Assert the command exists with a given exit code
     */
    assertNotExitCode(code: number): void;
    /**
     * Assert the command exists with zero exit code
     */
    assertSucceeded(): void;
    /**
     * Assert the command exists with non-zero exit code
     */
    assertFailed(): void;
    /**
     * Assert command to log the expected message
     */
    assertLog(message: string, stream?: 'stdout' | 'stderr'): void;
    /**
     * Assert command to log the expected message
     */
    assertLogMatches(matchingRegex: RegExp, stream?: 'stdout' | 'stderr'): void;
    /**
     * Assert the command prints a table to stdout
     */
    assertTableRows(rows: string[][]): void;
}
