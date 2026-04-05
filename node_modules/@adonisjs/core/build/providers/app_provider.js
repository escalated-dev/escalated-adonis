/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { Config } from '../modules/config.js';
import { Logger } from '../modules/logger.js';
import { Application } from '../modules/app.js';
import { Dumper } from '../modules/dumper/dumper.js';
import { Encryption } from '../modules/encryption.js';
import { Router, Server } from '../modules/http/main.js';
import { BaseEvent, Emitter } from '../modules/events.js';
import BodyParserMiddleware from '../modules/bodyparser/bodyparser_middleware.js';
/**
 * The Application Service provider registers all the baseline
 * features required to run the framework.
 */
export default class AppServiceProvider {
    app;
    constructor(app) {
        this.app = app;
    }
    /**
     * Registers test utils with the container
     */
    registerTestUtils() {
        this.app.container.singleton('testUtils', async () => {
            const { TestUtils } = await import('../src/test_utils/main.js');
            return new TestUtils(this.app);
        });
    }
    /**
     * Registers ace with the container
     */
    registerAce() {
        this.app.container.singleton('ace', async () => {
            const { createAceKernel } = await import('../modules/ace/create_kernel.js');
            return createAceKernel(this.app);
        });
    }
    /**
     * Registers the application to the container
     */
    registerApp() {
        this.app.container.singleton(Application, () => this.app);
        this.app.container.alias('app', Application);
    }
    /**
     * Registers the logger class to resolve the default logger
     */
    registerLogger() {
        this.app.container.singleton(Logger, async (resolver) => {
            const loggerManager = await resolver.make('logger');
            return loggerManager.use();
        });
    }
    /**
     * Registers the logger manager to the container
     */
    registerLoggerManager() {
        this.app.container.singleton('logger', async () => {
            const { LoggerManager } = await import('../modules/logger.js');
            const config = this.app.config.get('logger');
            return new LoggerManager(config);
        });
    }
    /**
     * Registers the config to the container
     */
    registerConfig() {
        this.app.container.singleton(Config, () => this.app.config);
        this.app.container.alias('config', Config);
    }
    /**
     * Registers emitter service to the container
     */
    registerEmitter() {
        this.app.container.singleton(Emitter, async () => {
            return new Emitter(this.app);
        });
        this.app.container.alias('emitter', Emitter);
    }
    /**
     * Register the encryption service to the container
     */
    registerEncryption() {
        this.app.container.singleton(Encryption, () => {
            const appKey = this.app.config.get('app.appKey');
            return new Encryption({ secret: appKey });
        });
        this.app.container.alias('encryption', Encryption);
    }
    /**
     * Registers the HTTP server with the container as a singleton
     */
    registerServer() {
        this.app.container.singleton(Server, async (resolver) => {
            const encryption = await resolver.make('encryption');
            const emitter = await resolver.make('emitter');
            const logger = await resolver.make('logger');
            const config = this.app.config.get('app.http');
            return new Server(this.app, encryption, emitter, logger, config);
        });
        this.app.container.alias('server', Server);
    }
    /**
     * Registers router with the container as a singleton
     */
    registerRouter() {
        this.app.container.singleton(Router, async (resolver) => {
            const server = await resolver.make('server');
            return server.getRouter();
        });
        this.app.container.alias('router', Router);
    }
    /**
     * Self construct bodyparser middleware class, since it needs
     * config that cannot be resolved by the container
     */
    registerBodyParserMiddleware() {
        this.app.container.bind(BodyParserMiddleware, () => {
            const config = this.app.config.get('bodyparser');
            return new BodyParserMiddleware(config, this.app.experimentalFlags);
        });
    }
    /**
     * Registeres singleton instance of the "Dumper" module configured
     * via the "config/app.ts" file.
     */
    registerDumper() {
        this.app.container.singleton(Dumper, async () => {
            const config = this.app.config.get('app.dumper', {});
            const dumper = new Dumper(this.app);
            if (config.html) {
                dumper.configureHtmlOutput(config.html);
            }
            if (config.console) {
                dumper.configureAnsiOutput(config.console);
            }
            return dumper;
        });
        this.app.container.alias('dumper', Dumper);
    }
    /**
     * Registers bindings
     */
    register() {
        this.registerApp();
        this.registerAce();
        this.registerDumper();
        this.registerLoggerManager();
        this.registerLogger();
        this.registerConfig();
        this.registerEmitter();
        this.registerEncryption();
        this.registerTestUtils();
        this.registerServer();
        this.registerRouter();
        this.registerBodyParserMiddleware();
    }
    async boot() {
        BaseEvent.useEmitter(await this.app.container.make('emitter'));
    }
}
