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
import { args, BaseCommand, flags } from '../modules/ace/main.js';
/**
 * The eject command is used to eject templates to the user
 * application codebase for customizing them
 */
export default class Eject extends BaseCommand {
    static commandName = 'eject';
    static description = 'Eject scaffolding stubs to your application root';
    async run() {
        const stubs = await this.app.stubs.create();
        const copied = await stubs.copy(this.stubPath, {
            pkg: this.pkg,
        });
        copied.forEach((stubPath) => {
            this.logger.success(`eject ${slash(this.app.relativePath(stubPath))}`);
        });
    }
}
__decorate([
    args.string({ description: 'Path to the stubs directory or a single stub file' })
], Eject.prototype, "stubPath", void 0);
__decorate([
    flags.string({
        description: 'Mention package name for searching stubs',
        default: '@adonisjs/core',
    })
], Eject.prototype, "pkg", void 0);
