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
import { flags } from '@adonisjs/core/ace';
import MigrationsBase from './_base.js';
import { MigrationRunner } from '../../src/migration/runner.js';
/**
 * The command is meant to migrate the database by executing migrations
 * in `up` direction.
 */
export default class Migrate extends MigrationsBase {
    static commandName = 'migration:run';
    static description = 'Migrate database by running pending migrations';
    static options = {
        startApp: true,
    };
    migrator;
    /**
     * Display migrations result in one compact single-line output
     */
    compactOutput = false;
    /**
     * Instantiating the migrator instance
     */
    async instantiateMigrator() {
        const db = await this.app.container.make('lucid.db');
        this.migrator = new MigrationRunner(db, this.app, {
            direction: 'up',
            connectionName: this.connection,
            dryRun: this.dryRun,
            disableLocks: this.disableLocks,
        });
    }
    /**
     * Run as a subcommand. Never close database connections or exit
     * process inside this method
     */
    async runAsSubCommand() {
        const db = await this.app.container.make('lucid.db');
        this.connection = this.connection || db.primaryConnectionName;
        /**
         * Continue with migrations when not in prod or force flag
         * is passed
         */
        let continueMigrations = !this.app.inProduction || this.force;
        if (!continueMigrations) {
            continueMigrations = await this.takeProductionConsent();
        }
        /**
         * Do not continue when in prod and the prompt was cancelled
         */
        if (!continueMigrations) {
            return;
        }
        /**
         * Invalid database connection
         */
        if (!db.manager.has(this.connection)) {
            this.printNotAValidConnection(this.connection);
            this.exitCode = 1;
            return;
        }
        await this.instantiateMigrator();
        await this.runMigrations(this.migrator, this.connection);
    }
    /**
     * Branching out, so that if required we can implement
     * "runAsMain" separately from "runAsSubCommand".
     *
     * For now, they both are the same
     */
    async runAsMain() {
        await this.runAsSubCommand();
    }
    /**
     * Handle command
     */
    async run() {
        if (this.isMain) {
            await this.runAsMain();
        }
        else {
            await this.runAsSubCommand();
        }
    }
    /**
     * Lifecycle method invoked by ace after the "run"
     * method.
     */
    async completed() {
        if (this.migrator && this.isMain) {
            await this.migrator.close();
        }
    }
}
__decorate([
    flags.string({ description: 'Define a custom database connection', alias: 'c' })
], Migrate.prototype, "connection", void 0);
__decorate([
    flags.boolean({ description: 'Explicitly force to run migrations in production' })
], Migrate.prototype, "force", void 0);
__decorate([
    flags.boolean({ description: 'Do not run actual queries. Instead view the SQL output' })
], Migrate.prototype, "dryRun", void 0);
__decorate([
    flags.boolean({ description: 'A compact single-line output' })
], Migrate.prototype, "compactOutput", void 0);
__decorate([
    flags.boolean({ description: 'Disable locks acquired to run migrations safely' })
], Migrate.prototype, "disableLocks", void 0);
