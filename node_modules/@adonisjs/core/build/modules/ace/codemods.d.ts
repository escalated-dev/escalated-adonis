import { EventEmitter } from 'node:events';
import type { UIPrimitives } from '@adonisjs/ace/types';
import type { CodeTransformer } from '@adonisjs/assembler/code_transformer';
import type { MiddlewareNode, EnvValidationNode, BouncerPolicyNode } from '@adonisjs/assembler/types';
import type { Application } from '../app.js';
/**
 * Codemods to modify AdonisJS source files. The codemod APIs relies on
 * "@adonisjs/assembler" package and it must be installed as a dependency
 * inside user application.
 */
export declare class Codemods extends EventEmitter {
    #private;
    /**
     * Overwrite existing files when generating files
     * from stubs
     */
    overwriteExisting: boolean;
    /**
     * Display verbose logs for package installation
     */
    verboseInstallOutput: boolean;
    constructor(app: Application<any>, cliLogger: UIPrimitives['logger']);
    /**
     * Define one or more environment variables
     */
    defineEnvVariables<T extends Record<string, number | string | boolean>>(environmentVariables: T, options?: {
        omitFromExample?: Array<keyof T>;
    }): Promise<void>;
    /**
     * Returns the TsMorph project instance
     * See https://ts-morph.com/
     */
    getTsMorphProject(): Promise<InstanceType<typeof import('@adonisjs/assembler/code_transformer').CodeTransformer>['project'] | undefined>;
    /**
     * Define validations for the environment variables
     */
    defineEnvValidations(validations: EnvValidationNode): Promise<void>;
    /**
     * Define validations for the environment variables
     */
    registerMiddleware(stack: 'server' | 'router' | 'named', middleware: MiddlewareNode[]): Promise<void>;
    /**
     * Register bouncer policies to the list of policies
     * collection exported from the "app/policies/main.ts"
     * file.
     */
    registerPolicies(policies: BouncerPolicyNode[]): Promise<void>;
    /**
     * Update RCFile
     */
    updateRcFile(...params: Parameters<CodeTransformer['updateRcFile']>): Promise<void>;
    /**
     * Register a new Vite plugin in the `vite.config.ts` file
     */
    registerVitePlugin(...params: Parameters<CodeTransformer['addVitePlugin']>): Promise<void>;
    /**
     * Register a new Japa plugin in the `tests/bootstrap.ts` file
     */
    registerJapaPlugin(...params: Parameters<CodeTransformer['addJapaPlugin']>): Promise<void>;
    /**
     * Generate the stub
     */
    makeUsingStub(stubsRoot: string, stubPath: string, stubState: Record<string, any>): Promise<{
        relativeFileName: string;
        contents: string;
        destination: any;
        attributes: Record<string, any>;
        status: "created";
        skipReason: null;
    } | {
        relativeFileName: string;
        contents: string;
        destination: any;
        attributes: Record<string, any>;
        status: "force_created";
        skipReason: null;
    } | {
        relativeFileName: string;
        contents: string;
        destination: any;
        attributes: Record<string, any>;
        status: "skipped";
        skipReason: string;
    }>;
    /**
     * Install packages using the correct package manager
     * You can specify version of each package by setting it in the
     * name like :
     *
     * ```
     * this.installPackages([{ name: '@adonisjs/lucid@next', isDevDependency: false }])
     * ```
     */
    installPackages(packages: {
        name: string;
        isDevDependency: boolean;
    }[]): Promise<void>;
    /**
     * List the packages one should install before using the packages
     */
    listPackagesToInstall(packages: {
        name: string;
        isDevDependency: boolean;
    }[]): Promise<void>;
}
