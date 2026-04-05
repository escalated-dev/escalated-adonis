import type { Application } from '../application.js';
/**
 * The stub class uses tempura template engine to process
 * a stub template and generate a resource file.
 *
 * Finding the correct stub to use is outside of the scope
 * of this class.
 */
export declare class Stub {
    #private;
    constructor(app: Application<any>, stubContents: string, stubPath: string);
    /**
     * Prepare stub to be written to the disk
     */
    prepare(stubData: Record<string, any>): Promise<{
        contents: string;
        destination: any;
        force: any;
        attributes: Record<string, any>;
    }>;
    /**
     * Generate resource for the stub. Writes file to the disk
     */
    generate(stubData: Record<string, any>): Promise<{
        contents: string;
        destination: any;
        attributes: Record<string, any>;
        status: "created";
        skipReason: null;
    } | {
        contents: string;
        destination: any;
        attributes: Record<string, any>;
        status: "force_created";
        skipReason: null;
    } | {
        contents: string;
        destination: any;
        attributes: Record<string, any>;
        status: "skipped";
        skipReason: string;
    }>;
}
