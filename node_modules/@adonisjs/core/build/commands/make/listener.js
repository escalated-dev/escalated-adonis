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
 * The make listener command to create a class based event
 * listener
 */
export default class MakeListener extends BaseCommand {
    static commandName = 'make:listener';
    static description = 'Create a new event listener class';
    static options = {
        allowUnknownFlags: true,
    };
    /**
     * The stub to use for generating the event listener
     */
    stubPath = 'make/listener/main.stub';
    prepare() {
        if (this.event) {
            this.stubPath = 'make/listener/for_event.stub';
        }
    }
    async run() {
        const codemods = await this.createCodemods();
        if (this.event) {
            const { exitCode } = await this.kernel.exec('make:event', [this.event]);
            /**
             * Create listener only when make:event is completed successfully
             */
            if (exitCode === 0) {
                const eventEntity = this.app.generators.createEntity(this.event);
                await codemods.makeUsingStub(stubsRoot, this.stubPath, {
                    event: eventEntity,
                    flags: this.parsed.flags,
                    entity: this.app.generators.createEntity(this.name),
                });
            }
            return;
        }
        await codemods.makeUsingStub(stubsRoot, this.stubPath, {
            flags: this.parsed.flags,
            entity: this.app.generators.createEntity(this.name),
        });
    }
}
__decorate([
    args.string({ description: 'Name of the event listener' })
], MakeListener.prototype, "name", void 0);
__decorate([
    flags.string({
        description: 'Generate an event class alongside the listener',
        alias: 'e',
    })
], MakeListener.prototype, "event", void 0);
