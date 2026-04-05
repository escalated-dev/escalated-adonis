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
import string from '@poppinss/utils/string';
import { stubsRoot } from '../../stubs/main.js';
import { args, flags, BaseCommand } from '../../modules/ace/main.js';
/**
 * The make controller command to create an HTTP controller
 */
export default class MakeController extends BaseCommand {
    static commandName = 'make:controller';
    static description = 'Create a new HTTP controller class';
    static options = {
        allowUnknownFlags: true,
    };
    /**
     * The stub to use for generating the controller
     */
    stubPath = 'make/controller/main.stub';
    /**
     * Preparing the command state
     */
    async prepare() {
        /**
         * Use actions stub
         */
        if (this.actions) {
            this.stubPath = 'make/controller/actions.stub';
        }
        /**
         * Use resource stub
         */
        if (this.resource) {
            if (this.actions) {
                this.logger.warning('Cannot use --resource flag with actions. Ignoring --resource');
            }
            else {
                this.stubPath = 'make/controller/resource.stub';
            }
        }
        /**
         * Use api stub
         */
        if (this.api) {
            if (this.actions) {
                this.logger.warning('Cannot use --api flag with actions. Ignoring --api');
            }
            else {
                this.stubPath = 'make/controller/api.stub';
            }
        }
        /**
         * Log warning when both flags are used together
         */
        if (this.resource && this.api && !this.actions) {
            this.logger.warning('--api and --resource flags cannot be used together. Ignoring --resource');
        }
    }
    async run() {
        const codemods = await this.createCodemods();
        await codemods.makeUsingStub(stubsRoot, this.stubPath, {
            flags: this.parsed.flags,
            actions: this.actions?.map((action) => string.camelCase(action)),
            entity: this.app.generators.createEntity(this.name),
            singular: this.singular,
        });
    }
}
__decorate([
    args.string({ description: 'The name of the controller' })
], MakeController.prototype, "name", void 0);
__decorate([
    args.spread({ description: 'Create controller with custom method names', required: false })
], MakeController.prototype, "actions", void 0);
__decorate([
    flags.boolean({
        description: 'Generate controller in singular form',
        alias: 's',
    })
], MakeController.prototype, "singular", void 0);
__decorate([
    flags.boolean({
        description: 'Generate resourceful controller with methods to perform CRUD actions on a resource',
        alias: 'r',
    })
], MakeController.prototype, "resource", void 0);
__decorate([
    flags.boolean({
        description: 'Generate resourceful controller without the "edit" and the "create" methods',
        alias: 'a',
    })
], MakeController.prototype, "api", void 0);
