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
import { MigrationRunner } from '../../src/migration/runner.js';
/**
 * The command is meant to migrate the database by execute migrations
 * in `up` direction.
 */
export default class Status extends BaseCommand {
    static commandName = 'migration:status';
    static description = 'View migrations status';
    static options = {
        startApp: true,
    };
    migrator;
    /**
     * Not a valid connection
     */
    printNotAValidConnection(connection) {
        this.logger.error(`"${connection}" is not a valid connection name. Double check "config/database" file`);
    }
    /**
     * Colorizes the status string
     */
    colorizeStatus(status) {
        switch (status) {
            case 'pending':
                return this.colors.yellow('pending');
            case 'migrated':
                return this.colors.green('completed');
            case 'corrupt':
                return this.colors.red('corrupt');
        }
    }
    /**
     * Instantiating the migrator instance
     */
    async instantiateMigrator() {
        const db = await this.app.container.make('lucid.db');
        this.migrator = new MigrationRunner(db, this.app, {
            direction: 'up',
            connectionName: this.connection,
        });
    }
    /**
     * Render list inside a table
     */
    renderList(list) {
        const table = this.ui.table();
        table.head(['Name', 'Status', 'Batch', 'Message']);
        /**
         * Push a new row to the table
         */
        list.forEach((node) => {
            table.row([
                node.name,
                this.colorizeStatus(node.status),
                node.batch ? String(node.batch) : 'NA',
                node.status === 'corrupt' ? 'The migration file is missing on filesystem' : '',
            ]);
        });
        table.render();
    }
    /**
     * Run as a subcommand. Never close database connections or exit
     * process inside this method
     */
    async runAsSubCommand() {
        const db = await this.app.container.make('lucid.db');
        this.connection = this.connection || db.primaryConnectionName;
        /**
         * Not a valid connection
         */
        if (!db.manager.has(this.connection)) {
            this.printNotAValidConnection(this.connection);
            this.exitCode = 1;
            return;
        }
        await this.instantiateMigrator();
        this.renderList(await this.migrator.getList());
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
], Status.prototype, "connection", void 0);
