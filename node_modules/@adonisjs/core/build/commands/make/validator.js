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
import { stubsRoot } from '../../stubs/main.js';
import { args, flags, BaseCommand } from '../../modules/ace/main.js';
/**
 * Make a new VineJS validator
 */
export default class MakeValidator extends BaseCommand {
    static commandName = 'make:validator';
    static description = 'Create a new file to define VineJS validators';
    static options = {
        allowUnknownFlags: true,
    };
    /**
     * The stub to use for generating the validator
     */
    stubPath = 'make/validator/main.stub';
    /**
     * Preparing the command state
     */
    async prepare() {
        /**
         * Use resource stub
         */
        if (this.resource) {
            this.stubPath = 'make/validator/resource.stub';
        }
    }
    async run() {
        const codemods = await this.createCodemods();
        await codemods.makeUsingStub(stubsRoot, this.stubPath, {
            flags: this.parsed.flags,
            entity: this.app.generators.createEntity(this.name),
        });
    }
}
__decorate([
    args.string({ description: 'Name of the validator file' })
], MakeValidator.prototype, "name", void 0);
__decorate([
    flags.boolean({
        description: 'Create a file with pre-defined validators for create and update actions',
    })
], MakeValidator.prototype, "resource", void 0);
