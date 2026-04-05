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
export default class DbWipe extends BaseCommand {
    static commandName = 'db:wipe';
    static description = 'Drop all tables, views and types in database';
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
     * Prompts to take consent when wiping the database in production
     */
    async takeProductionConsent() {
        const question = 'You are in production environment. Want to continue wiping the database?';
        try {
            return await this.prompt.confirm(question);
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Drop all views (if asked for and supported)
     */
    async performDropViews(client, schemas) {
        if (!this.dropViews) {
            return;
        }
        if (!client.dialect.supportsViews) {
            this.logger.warning(`Dropping views is not supported by "${client.dialect.name}"`);
        }
        await client.dropAllViews(schemas);
        this.logger.success('Dropped views successfully');
    }
    /**
     * Drop all tables
     */
    async performDropTables(client, schemas) {
        await client.dropAllTables(schemas);
        this.logger.success('Dropped tables successfully');
    }
    /**
     * Drop all types (if asked for and supported)
     */
    async performDropTypes(client, schemas) {
        if (!this.dropTypes) {
            return;
        }
        if (!client.dialect.supportsTypes) {
            this.logger.warning(`Dropping types is not supported by "${client.dialect.name}"`);
        }
        await client.dropAllTypes(schemas);
        this.logger.success('Dropped types successfully');
    }
    /**
     * Drop all domains (if asked for and supported)
     */
    async performDropDomains(client, schemas) {
        if (!this.dropDomains) {
            return;
        }
        if (!client.dialect.supportsDomains) {
            this.logger.warning(`Dropping domains is not supported by "${client.dialect.name}"`);
        }
        await client.dropAllDomains(schemas);
        this.logger.success('Dropped domains successfully');
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
        let continueWipe = !this.app.inProduction || this.force;
        if (!continueWipe) {
            continueWipe = await this.takeProductionConsent();
        }
        /**
         * Do not continue when in prod and the prompt was cancelled
         */
        if (!continueWipe) {
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
        await this.performDropViews(connection, schemas);
        await this.performDropTables(connection, schemas);
        await this.performDropTypes(connection, schemas);
        await this.performDropDomains(connection, schemas);
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
], DbWipe.prototype, "connection", void 0);
__decorate([
    flags.boolean({ description: 'Drop all views' })
], DbWipe.prototype, "dropViews", void 0);
__decorate([
    flags.boolean({ description: 'Drop all custom types (Postgres only)' })
], DbWipe.prototype, "dropTypes", void 0);
__decorate([
    flags.boolean({ description: 'Drop all domains (Postgres only)' })
], DbWipe.prototype, "dropDomains", void 0);
__decorate([
    flags.boolean({ description: 'Explicitly force command to run in production' })
], DbWipe.prototype, "force", void 0);
