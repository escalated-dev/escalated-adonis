import { Targets } from './create.js';
/**
 * Create the targets array conditionally.
 */
export declare function targets(): Targets;
export declare namespace targets {
    var file: typeof import("./file.js").file;
    var pretty: typeof import("./pretty.js").pretty;
}
