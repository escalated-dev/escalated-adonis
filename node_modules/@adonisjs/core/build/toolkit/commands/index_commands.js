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
import { join } from 'node:path';
import { args, BaseCommand, IndexGenerator } from '@adonisjs/ace';
/**
 * Generates index of commands with a loader. Must be called against
 * the TypeScript compiled output.
 */
export default class IndexCommand extends BaseCommand {
    static commandName = 'index';
    static description = 'Create an index of commands along with a lazy loader';
    async run() {
        await new IndexGenerator(join(process.cwd(), this.commandsDir)).generate();
    }
}
__decorate([
    args.string({ description: 'Relative path from cwd to the commands directory' })
], IndexCommand.prototype, "commandsDir", void 0);
