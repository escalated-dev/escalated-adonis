/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { RuntimeException } from '@poppinss/utils';
import { Hash } from '../modules/hash/main.js';
import { configProvider } from '../src/config_provider.js';
/**
 * Registers the passwords hasher with the container
 */
export default class HashServiceProvider {
    app;
    constructor(app) {
        this.app = app;
    }
    /**
     * Registering the hash class to resolve an instance with the
     * default hasher.
     */
    registerHash() {
        this.app.container.singleton(Hash, async (resolver) => {
            const hashManager = await resolver.make('hash');
            return hashManager.use();
        });
    }
    /**
     * Registers the hash manager with the container
     */
    registerHashManager() {
        this.app.container.singleton('hash', async () => {
            const hashConfigProvider = this.app.config.get('hash');
            /**
             * Resolve config from the provider
             */
            const config = await configProvider.resolve(this.app, hashConfigProvider);
            if (!config) {
                throw new RuntimeException('Invalid "config/hash.ts" file. Make sure you are using the "defineConfig" method');
            }
            const { HashManager } = await import('../modules/hash/main.js');
            return new HashManager(config);
        });
    }
    /**
     * Registers bindings
     */
    register() {
        this.registerHashManager();
        this.registerHash();
    }
}
