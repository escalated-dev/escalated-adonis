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
import { flags, BaseCommand } from '@adonisjs/core/ace';
/**
 * This command reset the database by rolling back to batch 0 and then
 * re-run all migrations.
 */
export default class Refresh extends BaseCommand {
    static commandName = 'migration:fresh';
    static description = 'Drop all tables and re-migrate the database';
    static options = {
        startApp: true,
    };
    /**
     * Converting command properties to arguments
     */
    getArgs() {
        const args = [];
        if (this.force) {
            args.push('--force');
        }
        if (this.connection) {
            args.push(`--connection=${this.connection}`);
        }
        if (this.disableLocks) {
            args.push('--disable-locks');
        }
        return args;
    }
    /**
     * Converting command properties to db:wipe arguments
     */
    getWipeArgs() {
        const args = this.getArgs();
        if (this.dropTypes) {
            args.push('--drop-types');
        }
        if (this.dropDomains) {
            args.push('--drop-domains');
        }
        if (this.dropViews) {
            args.push('--drop-views');
        }
        return args;
    }
    /**
     * Wipe the database
     */
    async runDbWipe() {
        const dbWipe = await this.kernel.exec('db:wipe', this.getWipeArgs());
        this.exitCode = dbWipe.exitCode;
        this.error = dbWipe.error;
    }
    /**
     * Run migrations
     */
    async runMigrations() {
        const migrate = await this.kernel.exec('migration:run', this.getArgs());
        this.exitCode = migrate.exitCode;
        this.error = migrate.error;
    }
    /**
     * Run seeders
     */
    async runDbSeed() {
        const args = [];
        if (this.connection) {
            args.push(`--connection=${this.connection}`);
        }
        const dbSeed = await this.kernel.exec('db:seed', args);
        this.exitCode = dbSeed.exitCode;
        this.error = dbSeed.error;
    }
    /**
     * Handle command
     */
    async run() {
        await this.runDbWipe();
        if (this.exitCode) {
            return;
        }
        await this.runMigrations();
        if (this.exitCode) {
            return;
        }
        if (this.seed) {
            await this.runDbSeed();
        }
    }
}
__decorate([
    flags.string({ description: 'Define a custom database connection', alias: 'c' })
], Refresh.prototype, "connection", void 0);
__decorate([
    flags.boolean({ description: 'Explicitly force command to run in production' })
], Refresh.prototype, "force", void 0);
__decorate([
    flags.boolean({ description: 'Run seeders' })
], Refresh.prototype, "seed", void 0);
__decorate([
    flags.boolean({ description: 'Drop all views' })
], Refresh.prototype, "dropViews", void 0);
__decorate([
    flags.boolean({ description: 'Drop all custom types (Postgres only)' })
], Refresh.prototype, "dropTypes", void 0);
__decorate([
    flags.boolean({ description: 'Drop all domains (Postgres only)' })
], Refresh.prototype, "dropDomains", void 0);
__decorate([
    flags.boolean({ description: 'Disable locks acquired to run migrations safely' })
], Refresh.prototype, "disableLocks", void 0);
