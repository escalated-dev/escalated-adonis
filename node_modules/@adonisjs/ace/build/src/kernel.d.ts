import { Prompt } from '@poppinss/prompts';
import { BaseCommand } from './commands/base.js';
import type { Flag, UIPrimitives, FlagListener, CommandMetaData, LoadersContract, ExecutorContract, LoadedHookHandler, AllowedInfoValues, LoadingHookHandler, FindingHookHandler, AbstractBaseCommand, ExecutedHookHandler, ExecutingHookHandler } from './types.js';
/**
 * The Ace kernel manages the registration and execution of commands.
 *
 * The kernel is the main entry point of a console application, and
 * is tailored for a standard CLI environment.
 */
export declare class Kernel<Command extends AbstractBaseCommand> {
    #private;
    errorHandler: {
        render(error: unknown, kernel: Kernel<any>): Promise<any>;
    };
    /**
     * The default executor for creating command's instance
     * and running them
     */
    static commandExecutor: ExecutorContract<typeof BaseCommand>;
    /**
     * The default command to use when creating kernel instance
     * via "static create" method.
     */
    static defaultCommand: typeof BaseCommand;
    /**
     * Creates an instance of kernel with the default executor
     * and default command
     */
    static create(): Kernel<typeof BaseCommand>;
    /**
     * The exit code for the kernel. The exit code is inferred
     * from the main code when not set explicitly.
     */
    exitCode?: number;
    /**
     * The UI primitives to use within commands
     */
    ui: UIPrimitives;
    /**
     * Instance of prompt to display CLI prompts. We share
     * a single instance with all the commands. This
     * allows trapping prompts for commands executed
     * internally.
     */
    prompt: Prompt;
    /**
     * CLI info map
     */
    info: Map<string, AllowedInfoValues>;
    /**
     * List of global flags
     */
    get flags(): ({
        name: string;
    } & Flag)[];
    constructor(defaultCommand: Command, executor: ExecutorContract<Command>);
    /**
     * Listen for CLI options and execute an action. Only one listener
     * can be defined per option.
     *
     * The callbacks are only executed for the main command
     */
    on(option: string, callback: FlagListener<Command>): this;
    /**
     * Define a global flag that is applicable for all the
     * commands.
     */
    defineFlag(name: string, options: Partial<Flag> & {
        type: 'string' | 'boolean' | 'array' | 'number';
    }): void;
    /**
     * Register a commands loader. The commands will be collected by
     * all the loaders.
     *
     * Incase multiple loaders returns a single command, the command from the
     * most recent loader will be used.
     */
    addLoader(loader: LoadersContract<Command> | (() => Promise<LoadersContract<Command>>)): this;
    /**
     * Register alias for a comamnd name.
     */
    addAlias(alias: string, command: string): this;
    /**
     * Check if a command or an alias is registered with kernel
     */
    hasCommand(commandName: string): boolean;
    /**
     * Get the current state of the kernel.
     */
    getState(): "booted" | "idle" | "running" | "completed";
    /**
     * Returns a flat list of commands metadata registered with the kernel.
     * The list is sorted alphabetically by the command name.
     */
    getCommands(): CommandMetaData[];
    /**
     * Get a list of commands for a specific namespace. All non-namespaces
     * commands will be returned if no namespace is defined.
     */
    getNamespaceCommands(namespace?: string): CommandMetaData[];
    /**
     * Returns the command metadata by its name. Returns null when the
     * command is missing.
     */
    getCommand(commandName: string): CommandMetaData | null;
    /**
     * Returns a reference for the default command. The return value
     * is the default command constructor
     */
    getDefaultCommand(): Command;
    /**
     * Returns reference to the main command
     */
    getMainCommand(): InstanceType<Command> | undefined;
    /**
     * Returns an array of aliases registered.
     *
     * - Call `getCommandAliases` method to get aliases for a given command
     * - Call `getAliasCommand` to get the command or a given alias
     */
    getAliases(): string[];
    /**
     * Returns the command metata for a given alias. Returns null
     * if alias is not recognized.
     */
    getAliasCommand(alias: string): CommandMetaData | null;
    /**
     * Returns an array of aliases for a given command
     */
    getCommandAliases(commandName: string): string[];
    /**
     * Returns a list of namespaces. The list is sorted alphabetically
     * by the namespace name
     */
    getNamespaces(): string[];
    /**
     * Returns an array of command and aliases name suggestions for
     * a given keyword.
     */
    getCommandSuggestions(keyword: string): string[];
    /**
     * Returns an array of namespaces suggestions for a given keyword.
     */
    getNamespaceSuggestions(keyword: string): string[];
    /**
     * Listen for the event before we begin the process of finding
     * the command.
     */
    finding(callback: FindingHookHandler): this;
    /**
     * Listen for the event when importing the command
     */
    loading(callback: LoadingHookHandler): this;
    /**
     * Listen for the event when the command has been imported
     */
    loaded(callback: LoadedHookHandler<Command>): this;
    /**
     * Listen for the event before we start to execute the command.
     */
    executing(callback: ExecutingHookHandler<InstanceType<Command>>): this;
    /**
     * Listen for the event after the command has been executed
     */
    executed(callback: ExecutedHookHandler<InstanceType<Command>>): this;
    /**
     * Loads commands from all the registered loaders. The "addLoader" method
     * must be called before calling the "load" method.
     */
    boot(): Promise<void>;
    /**
     * Find a command by its name
     */
    find<T extends Command>(commandName: string): Promise<T>;
    /**
     * Execute a command. The second argument is an array of commandline
     * arguments (without the command name)
     */
    exec<T extends Command>(commandName: string, argv: string[]): Promise<InstanceType<T>>;
    /**
     * Creates a command instance by parsing and validating
     * the command-line arguments.
     */
    create<T extends Command>(command: T, argv: string | string[]): Promise<InstanceType<T>>;
    /**
     * Handle process argv and execute the command. Calling this method
     * makes kernel own the process and register SIGNAL listeners
     */
    handle(argv: string[]): Promise<void>;
    /**
     * A named function that returns true. To be used
     * by flag listeners
     */
    shortcircuit(): boolean;
}
