import type { ApplicationService } from '../src/types.js';
type FactoryParameters = {
    app: ApplicationService;
};
/**
 * Prepares stubs from "@adonisjs/core" package. We do not publish this class as it
 * is for internal testing only using the "stubsRoot" of the core package
 */
export declare class StubsFactory {
    #private;
    /**
     * Merge custom factory parameters
     */
    merge(params: Partial<FactoryParameters>): this;
    /**
     * Prepares a stub
     */
    prepare(stubPath: string, data: Record<string, any>): Promise<{
        contents: string;
        destination: any;
        force: any;
        attributes: Record<string, any>;
    }>;
}
export {};
