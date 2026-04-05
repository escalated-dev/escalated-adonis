import type { Argon } from './drivers/argon.js';
import type { Scrypt } from './drivers/scrypt.js';
import type { Bcrypt } from './drivers/bcrypt.js';
import type { ConfigProvider } from '../../src/types.js';
import type { ArgonConfig, BcryptConfig, ScryptConfig, ManagerDriverFactory } from '../../types/hash.js';
/**
 * Resolved config from the config provider will be
 * the config accepted by the hash manager
 */
type ResolvedConfig<KnownHashers extends Record<string, ManagerDriverFactory | ConfigProvider<ManagerDriverFactory>>> = {
    default?: keyof KnownHashers;
    list: {
        [K in keyof KnownHashers]: KnownHashers[K] extends ConfigProvider<infer A> ? A : KnownHashers[K];
    };
};
/**
 * Define config for the hash service.
 */
export declare function defineConfig<KnownHashers extends Record<string, ManagerDriverFactory | ConfigProvider<ManagerDriverFactory>>>(config: {
    default?: keyof KnownHashers;
    list: KnownHashers;
}): ConfigProvider<ResolvedConfig<KnownHashers>>;
/**
 * Helpers to configure drivers inside the config file. The
 * drivers will be imported and constructed lazily.
 *
 * - Import happens when you first use the hash module
 * - Construction of drivers happens when you first use a driver
 */
export declare const drivers: {
    argon2: (config: ArgonConfig) => ConfigProvider<() => Argon>;
    bcrypt: (config: BcryptConfig) => ConfigProvider<() => Bcrypt>;
    scrypt: (config: ScryptConfig) => ConfigProvider<() => Scrypt>;
};
export {};
