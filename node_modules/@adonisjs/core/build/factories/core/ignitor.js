/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { Ignitor } from '../../src/ignitor/main.js';
import { drivers } from '../../modules/hash/define_config.js';
import { defineConfig as defineHttpConfig } from '../../modules/http/main.js';
import { defineConfig as defineLoggerConfig } from '../../modules/logger.js';
import { defineConfig as defineHashConfig } from '../../modules/hash/main.js';
import { defineConfig as defineBodyParserConfig } from '../../modules/bodyparser/main.js';
/**
 * Ignitor factory creates an instance of the AdonisJS ignitor
 */
export class IgnitorFactory {
    #preloadActions = [];
    #parameters = {};
    /**
     * A flag to know if we should load the core providers
     */
    #loadCoreProviders = false;
    /**
     * Define preload actions to run.
     */
    preload(action) {
        this.#preloadActions.push(action);
        return this;
    }
    /**
     * Merge core providers with user defined providers
     */
    #mergeCoreProviders(providers) {
        const coreProviders = [
            () => import('@adonisjs/core/providers/app_provider'),
            () => import('@adonisjs/core/providers/hash_provider'),
            () => import('@adonisjs/core/providers/repl_provider'),
        ];
        return coreProviders.concat(providers || []);
    }
    /**
     * Merge custom factory parameters
     */
    merge(params) {
        if (params.config) {
            this.#parameters.config = Object.assign(this.#parameters.config || {}, params.config);
        }
        if (params.rcFileContents) {
            this.#parameters.rcFileContents = Object.assign(this.#parameters.rcFileContents || {}, params.rcFileContents);
        }
        return this;
    }
    /**
     * Load core provider when booting the app
     */
    withCoreProviders() {
        this.#loadCoreProviders = true;
        return this;
    }
    /**
     * Merge default config for the core features. A shallow merge
     * is performed.
     */
    withCoreConfig() {
        this.merge({
            config: {
                app: {
                    appKey: 'averylongrandomsecretkey',
                    http: defineHttpConfig({}),
                },
                validator: {},
                bodyparser: defineBodyParserConfig({}),
                hash: defineHashConfig({
                    default: 'scrypt',
                    list: {
                        scrypt: drivers.scrypt({}),
                    },
                }),
                logger: defineLoggerConfig({
                    default: 'app',
                    loggers: {
                        app: {},
                    },
                }),
            },
        });
        return this;
    }
    /**
     * Create ignitor instance
     */
    create(appRoot, options) {
        return new Ignitor(appRoot, options).tap((app) => {
            app.booted(async () => {
                for (let action of this.#preloadActions) {
                    await action(app);
                }
            });
            if (this.#loadCoreProviders) {
                this.#parameters.rcFileContents = this.#parameters.rcFileContents || {};
                this.#parameters.rcFileContents.providers = this.#mergeCoreProviders(this.#parameters.rcFileContents.providers);
            }
            this.#parameters.rcFileContents && app.rcContents(this.#parameters.rcFileContents);
            this.#parameters.config && app.useConfig(this.#parameters.config);
        });
    }
}
