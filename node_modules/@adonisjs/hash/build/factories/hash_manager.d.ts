import { HashManager } from '../index.js';
import { Scrypt } from '../src/drivers/scrypt.js';
import { ManagerDriverFactory } from '../src/types.js';
type Config<KnownHashers extends Record<string, ManagerDriverFactory>> = {
    default?: keyof KnownHashers;
    list: KnownHashers;
};
/**
 * Hash manager factory is used to create an instance of hash manager
 * for testing
 */
export declare class HashManagerFactory<KnownHashers extends Record<string, ManagerDriverFactory> = {
    scrypt: () => Scrypt;
}> {
    #private;
    constructor(config?: {
        default?: keyof KnownHashers;
        list: KnownHashers;
    });
    /**
     * Merge factory parameters
     */
    merge<Hashers extends Record<string, ManagerDriverFactory>>(config: Config<Hashers>): HashManagerFactory<Hashers>;
    /**
     * Create hash manager instance
     */
    create(): HashManager<KnownHashers>;
}
export {};
