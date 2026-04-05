import { installPackage, detectPackageManager } from '@antfu/install-pkg';
import { Project } from 'ts-morph';
import { RcFileTransformer } from './rc_file_transformer.js';
import type { MiddlewareNode, EnvValidationNode, BouncerPolicyNode } from '../types.js';
/**
 * This class is responsible for updating
 */
export declare class CodeTransformer {
    #private;
    /**
     * Exporting utilities to install package and detect
     * the package manager
     */
    installPackage: typeof installPackage;
    detectPackageManager: typeof detectPackageManager;
    /**
     * The TsMorph project
     */
    project: Project;
    constructor(cwd: URL);
    /**
     * Add new env variable validation in the
     * `env.ts` file
     */
    defineEnvValidations(definition: EnvValidationNode): Promise<void>;
    /**
     * Define new middlewares inside the `start/kernel.ts`
     * file
     *
     * This function is highly based on some assumptions
     * and will not work if you significantly tweaked
     * your `start/kernel.ts` file.
     */
    addMiddlewareToStack(stack: 'server' | 'router' | 'named', middleware: MiddlewareNode[]): Promise<void>;
    /**
     * Update the `adonisrc.ts` file
     */
    updateRcFile(callback: (transformer: RcFileTransformer) => void): Promise<void>;
    /**
     * Add a new Japa plugin in the `tests/bootstrap.ts` file
     */
    addJapaPlugin(pluginCall: string, importDeclarations: {
        isNamed: boolean;
        module: string;
        identifier: string;
    }[]): Promise<void>;
    /**
     * Add a new Vite plugin
     */
    addVitePlugin(pluginCall: string, importDeclarations: {
        isNamed: boolean;
        module: string;
        identifier: string;
    }[]): Promise<void>;
    /**
     * Adds a policy to the list of `policies` object configured
     * inside the `app/policies/main.ts` file.
     */
    addPolicies(policies: BouncerPolicyNode[]): Promise<void>;
}
