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
import { BaseCommand, flags } from '@adonisjs/core/ace';
/**
 * This command resets the database by rolling back to batch 0. Same
 * as calling "migration:rollback --batch=0"
 */
export default class Reset extends BaseCommand {
    static commandName = 'migration:reset';
    static description = 'Rollback all migrations';
    static options = {
        startApp: true,
    };
    /**
     * Converting command properties to arguments
     */
    getArgs() {
        const args = ['--batch=0'];
        if (this.force) {
            args.push('--force');
        }
        if (this.compactOutput) {
            args.push('--compact-output');
        }
        if (this.connection) {
            args.push(`--connection=${this.connection}`);
        }
        if (this.dryRun) {
            args.push('--dry-run');
        }
        if (this.disableLocks) {
            args.push('--disable-locks');
        }
        return args;
    }
    /**
     * Handle command
     */
    async run() {
        const rollback = await this.kernel.exec('migration:rollback', this.getArgs());
        this.exitCode = rollback.exitCode;
        this.error = rollback.error;
    }
}
__decorate([
    flags.string({ description: 'Define a custom database connection', alias: 'c' })
], Reset.prototype, "connection", void 0);
__decorate([
    flags.boolean({ description: 'Explicitly force command to run in production' })
], Reset.prototype, "force", void 0);
__decorate([
    flags.boolean({ description: 'Do not run actual queries. Instead view the SQL output' })
], Reset.prototype, "dryRun", void 0);
__decorate([
    flags.boolean({ description: 'A compact single-line output' })
], Reset.prototype, "compactOutput", void 0);
__decorate([
    flags.boolean({ description: 'Disable locks acquired to run migrations safely' })
], Reset.prototype, "disableLocks", void 0);
