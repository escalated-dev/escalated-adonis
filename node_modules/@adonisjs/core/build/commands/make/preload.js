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
import { args, flags, BaseCommand } from '../../modules/ace/main.js';
const ALLOWED_ENVIRONMENTS = ['web', 'console', 'test', 'repl'];
/**
 * Make a new preload file
 */
export default class MakePreload extends BaseCommand {
    static commandName = 'make:preload';
    static description = 'Create a new preload file inside the start directory';
    /**
     * The stub to use for generating the preload file
     */
    stubPath = 'make/preload/main.stub';
    /**
     * Validate the environments flag passed by the user
     */
    #isEnvironmentsFlagValid() {
        if (!this.environments || !this.environments.length) {
            return true;
        }
        return this.environments.every((one) => ALLOWED_ENVIRONMENTS.includes(one));
    }
    /**
     * Run command
     */
    async run() {
        /**
         * Ensure the environments are valid when provided via flag
         */
        if (!this.#isEnvironmentsFlagValid()) {
            this.logger.error(`Invalid environment(s) "${this.environments}". Only "${ALLOWED_ENVIRONMENTS}" are allowed`);
            return;
        }
        /**
         * Display prompt to know if we should register the preload
         * file inside the ".adonisrc.ts" file.
         */
        if (this.register === undefined) {
            this.register = await this.prompt.confirm('Do you want to register the preload file in .adonisrc.ts file?');
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
         * Creative relative path for the preload file from
         * the "./start" directory
         */
        const preloadFileRelativePath = slash(relative(this.app.startPath(), destination).replace(extname(destination), ''));
        await codemods.updateRcFile((rcFile) => {
            rcFile.addPreloadFile(`#start/${preloadFileRelativePath}`, this.environments);
        });
    }
}
__decorate([
    args.string({ description: 'Name of the preload file' })
], MakePreload.prototype, "name", void 0);
__decorate([
    flags.boolean({
        description: 'Auto register the preload file inside the .adonisrc.ts file',
        showNegatedVariantInHelp: true,
        alias: 'r',
    })
], MakePreload.prototype, "register", void 0);
__decorate([
    flags.array({
        description: `Define the preload file's environment. Accepted values are "${ALLOWED_ENVIRONMENTS}"`,
        alias: 'e',
    })
], MakePreload.prototype, "environments", void 0);
