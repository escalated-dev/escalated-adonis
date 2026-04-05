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
import { EnvEditor } from '@adonisjs/env/editor';
import { BaseCommand, flags } from '../modules/ace/main.js';
/**
 * The generate key command is used to generate the app key
 * and write it inside the .env file.
 */
export default class GenerateKey extends BaseCommand {
    static commandName = 'generate:key';
    static description = 'Generate a cryptographically secure random application key';
    async run() {
        let writeToFile = process.env.NODE_ENV !== 'production';
        if (this.force) {
            writeToFile = true;
        }
        if (this.show) {
            writeToFile = false;
        }
        const secureKey = string.random(32);
        if (writeToFile) {
            const editor = await EnvEditor.create(this.app.appRoot);
            editor.add('APP_KEY', secureKey, true);
            await editor.save();
            this.logger.action('add APP_KEY to .env').succeeded();
        }
        else {
            this.logger.log(`APP_KEY = ${secureKey}`);
        }
    }
}
__decorate([
    flags.boolean({
        description: 'Display the key on the terminal, instead of writing it to .env file',
    })
], GenerateKey.prototype, "show", void 0);
__decorate([
    flags.boolean({
        description: 'Force update .env file in production environment',
    })
], GenerateKey.prototype, "force", void 0);
