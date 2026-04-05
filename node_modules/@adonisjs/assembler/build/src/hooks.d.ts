import { RcFile, AssemblerHookHandler, SourceFileChangedHookHandler } from '@adonisjs/application/types';
export declare class AssemblerHooks {
    #private;
    constructor(config: RcFile['hooks']);
    /**
     * Resolve hooks needed for dev-time and register them to the Hooks instance
     */
    registerDevServerHooks(): Promise<void>;
    /**
     * Resolve hooks needed for build-time and register them to the Hooks instance
     */
    registerBuildHooks(): Promise<void>;
    /**
     * When the dev server is started
     */
    onDevServerStarted(...args: Parameters<AssemblerHookHandler>): Promise<void>;
    /**
     * When a source file changes
     */
    onSourceFileChanged(...args: Parameters<SourceFileChangedHookHandler>): Promise<void>;
    /**
     * When the build process is starting
     */
    onBuildStarting(...args: Parameters<AssemblerHookHandler>): Promise<void>;
    /**
     * When the build process is completed
     */
    onBuildCompleted(...args: Parameters<AssemblerHookHandler>): Promise<void>;
}
