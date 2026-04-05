/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { stubsRoot } from '../stubs/main.js';
import { args, BaseCommand, flags } from '../modules/ace/main.js';
import { RuntimeException } from '@poppinss/utils';
/**
 * The configure command is used to configure packages after installation
 */
export default class Configure extends BaseCommand {
    static commandName = 'configure';
    static description = 'Configure a package after it has been installed';
    static options = {
        allowUnknownFlags: true,
    };
    /**
     * Exposing all flags from the protected property "parsed"
     */
    get parsedFlags() {
        return this.parsed.flags;
    }
    /**
     * Exposing all args from the protected property "parsed"
     */
    get parsedArgs() {
        return this.parsed._;
    }
    /**
     * Returns the package main exports
     */
    async #getPackageSource(packageName) {
        try {
            const packageExports = await this.app.import(packageName);
            return packageExports;
        }
        catch (error) {
            if ((error.code && error.code === 'ERR_MODULE_NOT_FOUND') ||
                error.message.startsWith('Cannot find module')) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Registers VineJS provider
     */
    async #configureVineJS() {
        const codemods = await this.createCodemods();
        await codemods.updateRcFile((rcFile) => {
            rcFile.addProvider('@adonisjs/core/providers/vinejs_provider');
        });
    }
    /**
     * Registers Edge provider
     */
    async #configureEdge() {
        const codemods = await this.createCodemods();
        await codemods.updateRcFile((rcFile) => {
            rcFile.addProvider('@adonisjs/core/providers/edge_provider');
            rcFile.addMetaFile('resources/views/**/*.edge', false);
        });
    }
    /**
     * Configure health checks
     */
    async #configureHealthChecks() {
        const codemods = await this.createCodemods();
        await codemods.makeUsingStub(stubsRoot, 'make/health/main.stub', {
            flags: this.parsed.flags,
            entity: this.app.generators.createEntity('health'),
        });
        await codemods.makeUsingStub(stubsRoot, 'make/health/controller.stub', {
            flags: this.parsed.flags,
            entity: this.app.generators.createEntity('health_checks'),
        });
    }
    /**
     * Creates codemods as per configure command options
     */
    async createCodemods() {
        const codemods = await super.createCodemods();
        codemods.overwriteExisting = this.force === true;
        codemods.verboseInstallOutput = this.verbose === true;
        return codemods;
    }
    /**
     * Run method is invoked by ace automatically
     */
    async run() {
        if (this.name === 'vinejs') {
            return this.#configureVineJS();
        }
        if (this.name === 'edge') {
            return this.#configureEdge();
        }
        if (this.name === 'health_checks') {
            return this.#configureHealthChecks();
        }
        const packageExports = await this.#getPackageSource(this.name);
        if (!packageExports) {
            this.logger.error(`Cannot find module "${this.name}". Make sure to install it`);
            this.exitCode = 1;
            return;
        }
        /**
         * Warn, there are not instructions to run
         */
        if (!packageExports.configure) {
            this.logger.error(`Cannot configure module "${this.name}". The module does not export the configure hook`);
            this.exitCode = 1;
            return;
        }
        /**
         * Set stubsRoot property when package exports it
         */
        if (packageExports.stubsRoot) {
            this.stubsRoot = packageExports.stubsRoot;
        }
        /**
         * Run instructions
         */
        try {
            await packageExports.configure(this);
        }
        catch (error) {
            throw new RuntimeException(`Unable to configure package "${this.name}"`, {
                cause: error,
            });
        }
    }
}
__decorate([
    args.string({ description: 'Package name' })
], Configure.prototype, "name", void 0);
__decorate([
    flags.boolean({ description: 'Display logs in verbose mode', alias: 'v' })
], Configure.prototype, "verbose", void 0);
__decorate([
    flags.boolean({ description: 'Forcefully overwrite existing files', alias: 'f' })
], Configure.prototype, "force", void 0);
