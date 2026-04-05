/*
 * @adonisjs/assembler
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
import { args, BaseCommand } from '@adonisjs/core/ace';
/**
 * Command to make a new Factory
 */
export default class MakeFactory extends BaseCommand {
    static commandName = 'make:factory';
    static description = 'Make a new factory';
    static options = {
        allowUnknownFlags: true,
    };
    async run() {
        const codemods = await this.createCodemods();
        await codemods.makeUsingStub(stubsRoot, 'make/factory/main.stub', {
            flags: this.parsed.flags,
            entity: this.app.generators.createEntity(this.model),
            model: this.app.generators.createEntity(this.model),
        });
    }
}
__decorate([
    args.string({ description: 'Model name for which to create the factory' })
], MakeFactory.prototype, "model", void 0);
