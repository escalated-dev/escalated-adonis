/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
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
import { BaseCommand, args, flags } from '@adonisjs/core/ace';
import { stubsRoot } from '../stubs/main.js';
export default class MakeModel extends BaseCommand {
    static commandName = 'make:model';
    static description = 'Make a new Lucid model';
    static options = {
        allowUnknownFlags: true,
    };
    /**
     * Run migrations
     */
    async runMakeMigration() {
        if (!this.migration || this.exitCode) {
            return;
        }
        const makeMigration = await this.kernel.exec('make:migration', [this.name]);
        this.exitCode = makeMigration.exitCode;
        this.error = makeMigration.error;
    }
    /**
     * Make controller
     */
    async runMakeController() {
        if (!this.controller || this.exitCode) {
            return;
        }
        const makeController = await this.kernel.exec('make:controller', [this.name]);
        this.exitCode = makeController.exitCode;
        this.error = makeController.error;
    }
    /**
     * Make factory
     */
    async runMakeFactory() {
        if (!this.factory || this.exitCode) {
            return;
        }
        const makeFactory = await this.kernel.exec('make:factory', [this.name]);
        this.exitCode = makeFactory.exitCode;
        this.error = makeFactory.error;
    }
    /**
     * Execute command
     */
    async run() {
        const codemods = await this.createCodemods();
        await codemods.makeUsingStub(stubsRoot, 'make/model/main.stub', {
            flags: this.parsed.flags,
            entity: this.app.generators.createEntity(this.name),
        });
        await this.runMakeMigration();
        await this.runMakeController();
        await this.runMakeFactory();
    }
}
__decorate([
    args.string({ description: 'Name of the model class' })
], MakeModel.prototype, "name", void 0);
__decorate([
    flags.boolean({
        name: 'migration',
        alias: 'm',
        description: 'Generate the migration for the model',
    })
], MakeModel.prototype, "migration", void 0);
__decorate([
    flags.boolean({
        name: 'controller',
        alias: 'c',
        description: 'Generate the controller for the model',
    })
], MakeModel.prototype, "controller", void 0);
__decorate([
    flags.boolean({
        name: 'factory',
        alias: 'f',
        description: 'Generate a factory for the model',
    })
], MakeModel.prototype, "factory", void 0);
