import { Stub } from './stub.js';
import { Application } from '../application.js';
/**
 * Stub Manager is used to read and copy stubs from different sources. Also
 * allows creating resources from pre-existing stubs
 */
export declare class StubsManager {
    #private;
    constructor(app: Application<any>, publishTarget: string);
    /**
     * Creates an instance of stub by its name. The lookup is performed inside
     * the publishTarget and the optional source or pkg destination.
     */
    build(stubName: string, options?: {
        source?: string;
        pkg?: string;
    }): Promise<Stub>;
    /**
     * Copy one or more stub files from a custom location to publish
     * target.
     */
    copy(stubPath: string, options: {
        overwrite?: boolean;
    } & ({
        source: string;
    } | {
        pkg: string;
    })): Promise<string[]>;
}
