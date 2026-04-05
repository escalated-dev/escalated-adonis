import { Ignitor } from '../../index.js';
import type { IgnitorOptions } from '../../src/types.js';
import { TestUtils } from '../../src/test_utils/main.js';
/**
 * Creates an instance of TestUtils class
 */
export declare class TestUtilsFactory {
    create(ignitor: Ignitor): TestUtils;
    create(appRoot: URL, options?: IgnitorOptions): TestUtils;
}
