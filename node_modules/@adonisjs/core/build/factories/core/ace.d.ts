import { Ignitor } from '../../src/ignitor/main.js';
import type { IgnitorOptions } from '../../src/types.js';
import type { Kernel } from '../../modules/ace/kernel.js';
/**
 * Creates an instance of Ace kernel
 */
export declare class AceFactory {
    make(ignitor: Ignitor): Promise<Kernel>;
    make(appRoot: URL, options?: IgnitorOptions): Promise<Kernel>;
}
