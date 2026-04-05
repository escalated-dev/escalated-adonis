import type { AppEnvironments, RcFile } from '@adonisjs/application/types';
import { Project } from 'ts-morph';
/**
 * RcFileTransformer is used to transform the `adonisrc.ts` file
 * for adding new commands, providers, meta files etc
 */
export declare class RcFileTransformer {
    #private;
    constructor(cwd: URL, project: Project);
    /**
     * Add a new command to the rcFile
     */
    addCommand(commandPath: string): this;
    /**
     * Add a new preloaded file to the rcFile
     */
    addPreloadFile(modulePath: string, environments?: AppEnvironments[]): this;
    /**
     * Add a new provider to the rcFile
     */
    addProvider(providerPath: string, environments?: AppEnvironments[]): this;
    /**
     * Add a new meta file to the rcFile
     */
    addMetaFile(globPattern: string, reloadServer?: boolean): this;
    /**
     * Set directory name and path
     */
    setDirectory(key: string, value: string): this;
    /**
     * Set command alias
     */
    setCommandAlias(alias: string, command: string): this;
    /**
     * Add a new test suite to the rcFile
     */
    addSuite(suiteName: string, files: string | string[], timeout?: number): this;
    /**
     * Add a new assembler hook
     */
    addAssemblerHook(type: keyof NonNullable<RcFile['hooks']>, path: string): this;
    /**
     * Save the adonisrc.ts file
     */
    save(): Promise<void>;
}
