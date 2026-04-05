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
export default class DbTruncate extends BaseCommand {
    static commandName = 'db:truncate';
    static description = 'Truncate all tables in database';
    static options = {
        startApp: true,
    };
    /**
     * Not a valid connection
     */
    printNotAValidConnection(connection) {
        this.logger.error(`"${connection}" is not a valid connection name. Double check "config/database" file`);
    }
    /**
     * Prompts to take consent when truncating the database in production
     */
    async takeProductionConsent() {
        const question = 'You are in production environment. Want to continue truncating the database?';
        try {
            return await this.prompt.confirm(question);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Truncate all tables except adonis migrations table
     */
    async performTruncate(client, schemas) {
        let tables = await client.getAllTables(schemas);
        tables = tables.filter((table) => !['adonis_schema', 'adonis_schema_versions'].includes(table));
        await Promise.all(tables.map((table) => client.truncate(table, true)));
        this.logger.success('Truncated tables successfully');
    }
    /**
     * Run as a subcommand. Never close database connections or exit
     * process inside this method
     */
    async runAsSubCommand() {
        const db = await this.app.container.make('lucid.db');
        this.connection = this.connection || db.primaryConnectionName;
        const connection = db.connection(this.connection || db.primaryConnectionName);
        /**
         * Continue with clearing the database when not in production
         * or force flag is passed
         */
        let continueTruncate = !this.app.inProduction || this.force;
        if (!continueTruncate) {
            continueTruncate = await this.takeProductionConsent();
        }
        /**
         * Do not continue when in prod and the prompt was cancelled
         */
        if (!continueTruncate) {
            return;
        }
        /**
         * Invalid database connection
         */
        const managerConnection = db.manager.get(this.connection);
        if (!managerConnection) {
            this.printNotAValidConnection(this.connection);
            this.exitCode = 1;
            return;
        }
        let schemas = ['public'];
        if ('searchPath' in managerConnection.config && managerConnection.config.searchPath) {
            schemas = managerConnection.config.searchPath;
        }
        await this.performTruncate(connection, schemas);
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
        if (this.isMain) {
            const db = await this.app.container.make('lucid.db');
            await db.manager.closeAll(true);
        }
    }
}
__decorate([
    flags.string({ description: 'Define a custom database connection', alias: 'c' })
], DbTruncate.prototype, "connection", void 0);
__decorate([
    flags.boolean({ description: 'Explicitly force command to run in production' })
], DbTruncate.prototype, "force", void 0);
