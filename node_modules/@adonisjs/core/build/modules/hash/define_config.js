/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { InvalidArgumentsException } from '@poppinss/utils';
import debug from '../../src/debug.js';
import { configProvider } from '../../src/config_provider.js';
/**
 * Define config for the hash service.
 */
export function defineConfig(config) {
    /**
     * Hashers list should always be provided
     */
    if (!config.list) {
        throw new InvalidArgumentsException('Missing "list" property in hash config');
    }
    /**
     * The default hasher should be mentioned in the list
     */
    if (config.default && !config.list[config.default]) {
        throw new InvalidArgumentsException(`Missing "list.${String(config.default)}" in hash config. It is referenced by the "default" property`);
    }
    /**
     * Config provider to lazily import drivers as they are used inside
     * the user application
     */
    return configProvider.create(async (app) => {
        debug('resolving hash config');
        const hashersList = Object.keys(config.list);
        const hashers = {};
        for (let hasherName of hashersList) {
            const hasher = config.list[hasherName];
            if (typeof hasher === 'function') {
                hashers[hasherName] = hasher;
            }
            else {
                hashers[hasherName] = await hasher.resolver(app);
            }
        }
        return {
            default: config.default,
            list: hashers,
        };
    });
}
/**
 * Helpers to configure drivers inside the config file. The
 * drivers will be imported and constructed lazily.
 *
 * - Import happens when you first use the hash module
 * - Construction of drivers happens when you first use a driver
 */
export const drivers = {
    argon2: (config) => {
        return configProvider.create(async () => {
            const { Argon } = await import('./drivers/argon.js');
            debug('configuring argon driver');
            return () => new Argon(config);
        });
    },
    bcrypt: (config) => {
        return configProvider.create(async () => {
            const { Bcrypt } = await import('./drivers/bcrypt.js');
            debug('configuring bcrypt driver');
            return () => new Bcrypt(config);
        });
    },
    scrypt: (config) => {
        return configProvider.create(async () => {
            const { Scrypt } = await import('./drivers/scrypt.js');
            debug('configuring scrypt driver');
            return () => new Scrypt(config);
        });
    },
};
