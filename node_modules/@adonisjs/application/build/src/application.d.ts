import { Container } from '@adonisjs/fold';
import Macroable from '@poppinss/macroable';
import type { HookHandler } from '@poppinss/hooks/types';
import type { Importer, SemverNode, AppEnvironments, ApplicationStates, ExperimentalFlagsList } from './types.js';
import { FeatureFlags } from './feature_flags.js';
/**
 * Application class manages the state of an AdonisJS application. It includes
 *
 * - Setting up the base features like importing config and setting up logger.
 * - Parsing the "adonisrc.js" file
 * - Setting up the IoC container
 * - Registering an booting providers
 * - Invoking lifecycle methods on the providers and hooks
 */
export declare class Application<ContainerBindings extends Record<any, any>> extends Macroable {
    #private;
    /**
     * Store info metadata about the app.
     */
    info: Map<'appName' | 'version' | 'adonisVersion' | string, any>;
    /**
     * Returns the application name from the info map
     */
    get appName(): any;
    /**
     * Returns the application version from the info map
     */
    get version(): SemverNode | null;
    /**
     * The parsed version for the "@adonisjs/core" package.
     */
    get adonisVersion(): SemverNode | null;
    /**
     * The URL for the root of the application
     */
    get appRoot(): URL;
    /**
     * A boolean to know if the application has been booted
     */
    get isBooted(): boolean;
    /**
     * A boolean to know if the application is ready
     */
    get isReady(): boolean;
    /**
     * A boolean to know if the application has been terminated
     */
    get isTerminated(): boolean;
    /**
     * A boolean to know if the application is in the middle of getting
     * terminating
     */
    get isTerminating(): boolean;
    /**
     * Reference to the config class. The value is defined
     * after the "init" method call
     */
    get config(): import("@adonisjs/config").Config;
    /**
     * Reference to the parsed rc file. The value is defined
     * after the "init" method call
     */
    get rcFile(): import("./types.js").RcFile;
    /**
     * Normalized current NODE_ENV
     */
    get nodeEnvironment(): string;
    /**
     * Return true when `this.nodeEnvironment === 'production'`
     */
    get inProduction(): boolean;
    /**
     * Return true when `this.nodeEnvironment === 'development'`
     */
    get inDev(): boolean;
    /**
     * Returns true when `this.nodeEnvironment === 'test'`
     */
    get inTest(): boolean;
    /**
     * Find if the process is managed and run under
     * pm2
     */
    get managedByPm2(): boolean;
    /**
     * Reference to scaffolding generators
     */
    get generators(): {
        singularControllerNames: string[];
        createEntity(entityName: string): {
            path: string;
            name: string;
        };
        importPath(...paths: string[]): string;
        tableName(entityName: string): string;
        modelName(entityName: string): string;
        modelFileName(entityName: string): string;
        controllerName(entityName: string, singular?: boolean): string;
        controllerFileName(entityName: string, singular?: boolean): string;
        eventName(entityName: string): string;
        eventFileName(entityName: string): string;
        listenerName(entityName: string): string;
        listenerFileName(entityName: string): string;
        middlewareName(entityName: string): string;
        middlewareFileName(entityName: string): string;
        providerName(entityName: string): string;
        providerFileName(entityName: string): string;
        policyName(entityName: string): string;
        policyFileName(entityName: string): string;
        factoryName(entityName: string): string;
        factoryFileName(entityName: string): string;
        serviceName(entityName: string): string;
        serviceFileName(entityName: string): string;
        seederName(entityName: string): string;
        seederFileName(entityName: string): string;
        commandTerminalName(entityName: string): string;
        commandName(entityName: string): string;
        commandFileName(entityName: string): string;
        validatorName(entityName: string): string;
        validatorActionName(entityName: string, action: string): string;
        validatorFileName(entityName: string): string;
        exceptionName(entityName: string): string;
        exceptionFileName(entityName: string): string;
        mailerName(entityName: string, type?: "notification" | "provision"): string;
        mailerFileName(entityName: string, type?: "notification" | "provision"): string;
        mailName(entityName: string, type?: string): string;
        mailFileName(entityName: string, type?: string): string;
        testGroupName(entity: {
            path: string;
            name: string;
        }): string;
        testFileName(entityName: string): string;
        viewFileName(entityName: string): string;
    };
    /**
     * Reference to the stubs module to scaffold
     * resources or eject stubs
     */
    stubs: {
        create: () => Promise<import("./stubs/manager.js").StubsManager>;
    };
    /**
     * Check the status of the configured feature flags and act on them
     */
    experimentalFlags: FeatureFlags<ExperimentalFlagsList>;
    /**
     * A flag to know if VineJS provider is configured. When set
     * to true, you may import `@vinejs/vine` package
     */
    usingVineJS: boolean;
    /**
     * A flag to know if Edge provider is configured. When set
     * to true, you may import `edge.js` package
     */
    usingEdgeJS: boolean;
    /**
     * Reference to the AdonisJS IoC container. The value is defined
     * after the "init" method call
     */
    container: Container<ContainerBindings>;
    constructor(appRoot: URL, options: {
        environment: AppEnvironments;
        importer?: Importer;
    });
    /**
     * The current environment in which the application
     * is running
     */
    getEnvironment(): AppEnvironments;
    /**
     * Switch the environment in which the app is running. The
     * environment can only be changed before the app is
     * booted.
     */
    setEnvironment(environment: AppEnvironments): this;
    /**
     * The current state of the application.
     */
    getState(): ApplicationStates;
    /**
     * Specify the contents of the "adonisrc.js" file as
     * an object. Calling this method will disable loading
     * the "adonisrc.js" file from the disk.
     */
    rcContents(value: Record<string, any>): this;
    /**
     * Define the config values to use when booting the
     * config provider. Calling this method disables
     * reading files from the config directory.
     */
    useConfig(values: Record<any, any>): this;
    /**
     * Notify the parent process when the Node.js process is spawned with an IPC channel.
     * The arguments accepted are same as "process.send"
     */
    notify(message: any, sendHandle?: any, options?: {
        swallowErrors?: boolean | undefined;
        keepOpen?: boolean | undefined;
    }, callback?: (error: Error | null) => void): void;
    /**
     * Listen for a process signal. This method is same as calling
     * "process.on(signal)"
     */
    listen(signal: NodeJS.Signals, callback: NodeJS.SignalsListener): this;
    /**
     * Listen for a process signal once. This method is same as calling
     * "process.once(signal)"
     */
    listenOnce(signal: NodeJS.Signals, callback: NodeJS.SignalsListener): this;
    /**
     * Listen for a process signal conditionally.
     */
    listenIf(conditional: boolean, signal: NodeJS.Signals, callback: NodeJS.SignalsListener): this;
    /**
     * Listen for a process signal once conditionally.
     */
    listenOnceIf(conditional: boolean, signal: NodeJS.Signals, callback: NodeJS.SignalsListener): this;
    /**
     * Register hooks that are called before the app starts
     * the initiating process
     */
    initiating(handler: HookHandler<[Application<ContainerBindings>], [Application<ContainerBindings>]>): this;
    /**
     * Initiate the application. Calling this method performs following
     * operations.
     *
     * - Parses the "adonisrc.js" file
     * - Validate and set environment variables
     * - Loads the application config from the configured config dir.
     * - Configures the logger
     * - Instantiates the IoC container
     */
    init(): Promise<void>;
    /**
     * Register hooks that are called before the app boot
     * process starts
     */
    booting(handler: HookHandler<[Application<ContainerBindings>], [Application<ContainerBindings>]>): this;
    /**
     * Boot the application. Calling this method performs the following
     * operations.
     *
     * - Resolve providers and call the "register" method on them.
     * - Call the "boot" method on providers
     * - Run the "booted" hooks
     */
    boot(): Promise<void>;
    /**
     * Register a hook to get notified when the application has
     * been booted.
     *
     * The hook will be called immediately if the app has already
     * been booted.
     */
    booted(handler: HookHandler<[Application<ContainerBindings>], [Application<ContainerBindings>]>): Promise<void>;
    /**
     * Register hooks that are called when the app is starting
     */
    starting(handler: HookHandler<[Application<ContainerBindings>], [Application<ContainerBindings>]>): this;
    /**
     * Start the application. Calling this method performs the following
     * operations.
     *
     * - Run the "start" lifecycle hooks on all the providers
     * - Start the application by invoking the supplied callback
     * - Run the "ready" lifecycle hooks on all the providers
     * - Run the "ready" application hooks
     */
    start(callback: (app: this) => void | Promise<void>): Promise<void>;
    /**
     * Register hooks that are called when the app is
     * ready
     */
    ready(handler: HookHandler<[Application<ContainerBindings>], [Application<ContainerBindings>]>): Promise<void>;
    /**
     * Register hooks that are called before the app is
     * terminated.
     */
    terminating(handler: HookHandler<[Application<ContainerBindings>], [Application<ContainerBindings>]>): this;
    /**
     * Terminate application gracefully. Calling this method performs
     * the following operations.
     *
     * - Run "shutdown" hooks on all the providers
     * - Run "terminating" app lifecycle hooks
     */
    terminate(): Promise<void>;
    /**
     * Returns relative path to a file from the app root
     */
    relativePath(absolutePath: string): string;
    /**
     * Returns URL to a path from the application root.
     */
    makeURL(...paths: string[]): URL;
    /**
     * Returns file system path from the application root.
     */
    makePath(...paths: string[]): string;
    /**
     * Makes path to the config directory
     */
    configPath(...paths: string[]): string;
    /**
     * Makes path to the public directory
     */
    publicPath(...paths: string[]): string;
    /**
     * Makes path to the providers directory
     */
    providersPath(...paths: string[]): string;
    /**
     * Makes path to the factories directory
     */
    factoriesPath(...paths: string[]): string;
    /**
     * Makes path to the migrations directory
     */
    migrationsPath(...paths: string[]): string;
    /**
     * Makes path to the seeders directory
     */
    seedersPath(...paths: string[]): string;
    /**
     * Makes path to the language files directory
     */
    languageFilesPath(...paths: string[]): string;
    /**
     * Makes path to the views directory
     */
    viewsPath(...paths: string[]): string;
    /**
     * Makes path to the start directory
     */
    startPath(...paths: string[]): string;
    /**
     * Makes path to the tmp directory
     */
    tmpPath(...paths: string[]): string;
    /**
     * Makes path to the contracts directory
     * @deprecated
     */
    contractsPath(...paths: string[]): string;
    /**
     * Makes path to the http controllers directory
     */
    httpControllersPath(...paths: string[]): string;
    /**
     * Makes path to the models directory
     */
    modelsPath(...paths: string[]): string;
    /**
     * Makes path to the services directory
     */
    servicesPath(...paths: string[]): string;
    /**
     * Makes path to the exceptions directory
     */
    exceptionsPath(...paths: string[]): string;
    /**
     * Makes path to the mailers directory
     */
    mailersPath(...paths: string[]): string;
    /**
     * Makes path to the mails directory
     */
    mailsPath(...paths: string[]): string;
    /**
     * Makes path to the middleware directory
     */
    middlewarePath(...paths: string[]): string;
    /**
     * Makes path to the policies directory
     */
    policiesPath(...paths: string[]): string;
    /**
     * Makes path to the validators directory
     */
    validatorsPath(...paths: string[]): string;
    /**
     * Makes path to the commands directory
     */
    commandsPath(...paths: string[]): string;
    /**
     * Makes path to the events directory
     */
    eventsPath(...paths: string[]): string;
    /**
     * Makes path to the listeners directory
     */
    listenersPath(...paths: string[]): string;
    /**
     * Import a module by identifier. This method uses the importer function
     * defined at the time of creating the application instance and throws
     * an error if no importer was defined.
     */
    import(moduleIdentifier: string): any;
    /**
     * Import a module by identifier. This method uses the importer function
     * defined at the time of creating the application instance and throws
     * an error if no importer was defined.
     */
    importDefault<T extends object>(moduleIdentifier: string): Promise<T extends {
        default: infer A;
    } ? A : never>;
    /**
     * JSON representation of the application
     */
    toJSON(): {
        isReady: boolean;
        isTerminating: boolean;
        environment: AppEnvironments;
        nodeEnvironment: string;
        appName: any;
        version: string | null;
        adonisVersion: string | null;
    };
}
