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
import { slash } from '@poppinss/utils';
import { extname, relative } from 'node:path';
import { stubsRoot } from '../../stubs/main.js';
import { args, BaseCommand, flags } from '../../modules/ace/main.js';
const ALLOWED_ENVIRONMENTS = ['web', 'console', 'test', 'repl'];
/**
 * Make a new provider class
 */
export default class MakeProvider extends BaseCommand {
    static commandName = 'make:provider';
    static description = 'Create a new service provider class';
    /**
     * The stub to use for generating the provider class
     */
    stubPath = 'make/provider/main.stub';
    /**
     * Validate the environments flag passed by the user
     */
    #isEnvironmentsFlagValid() {
        if (!this.environments || !this.environments.length) {
            return true;
        }
        return this.environments.every((one) => ALLOWED_ENVIRONMENTS.includes(one));
    }
    async run() {
        /**
         * Ensure the environments are valid when provided via flag
         */
        if (!this.#isEnvironmentsFlagValid()) {
            this.logger.error(`Invalid environment(s) "${this.environments}". Only "${ALLOWED_ENVIRONMENTS}" are allowed`);
            return;
        }
        /**
         * Display prompt to know if we should register the provider
         * file inside the ".adonisrc.ts" file.
         */
        if (this.register === undefined) {
            this.register = await this.prompt.confirm('Do you want to register the provider in .adonisrc.ts file?');
        }
        const codemods = await this.createCodemods();
        const { destination } = await codemods.makeUsingStub(stubsRoot, this.stubPath, {
            flags: this.parsed.flags,
            entity: this.app.generators.createEntity(this.name),
        });
        /**
         * Do not register when prompt has been denied or "--no-register"
         * flag was used
         */
        if (!this.register) {
            return;
        }
        /**
         * Creative relative path for the provider file from
         * the "./start" directory
         */
        const providerRelativePath = slash(relative(this.app.providersPath(), destination).replace(extname(destination), ''));
        await codemods.updateRcFile((rcFile) => {
            rcFile.addProvider(`#providers/${providerRelativePath}`, this.environments);
        });
    }
}
__decorate([
    args.string({ description: 'Name of the provider' })
], MakeProvider.prototype, "name", void 0);
__decorate([
    flags.boolean({
        description: 'Auto register the provider inside the .adonisrc.ts file',
        showNegatedVariantInHelp: true,
        alias: 'r',
    })
], MakeProvider.prototype, "register", void 0);
__decorate([
    flags.array({
        description: `Define the provider environment. Accepted values are "${ALLOWED_ENVIRONMENTS}"`,
        alias: 'e',
    })
], MakeProvider.prototype, "environments", void 0);
