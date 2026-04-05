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
import { stubsRoot } from '../stubs/main.js';
import { args, BaseCommand, flags } from '@adonisjs/core/ace';
export default class MakeMigration extends BaseCommand {
    static commandName = 'make:migration';
    static description = 'Make a new migration file';
    static options = {
        startApp: true,
        allowUnknownFlags: true,
    };
    /**
     * Not a valid connection
     */
    printNotAValidConnection(connection) {
        this.logger.error(`"${connection}" is not a valid connection name. Double check "config/database" file`);
    }
    /**
     * Returns the directory for creating the migration file
     */
    async getDirectory(migrationPaths) {
        if (this.folder) {
            return this.folder;
        }
        let directories = migrationPaths?.length ? migrationPaths : ['database/migrations'];
        if (directories.length === 1) {
            return directories[0];
        }
        return this.prompt.choice('Select the migrations folder', directories, { name: 'folder' });
    }
    /**
     * Execute command
     */
    async run() {
        const db = await this.app.container.make('lucid.db');
        this.connection = this.connection || db.primaryConnectionName;
        const connection = db.getRawConnection(this.connection || db.primaryConnectionName);
        /**
         * Invalid database connection
         */
        if (!connection) {
            this.printNotAValidConnection(this.connection);
            this.exitCode = 1;
            return;
        }
        /**
         * Not allowed together, hence we must notify the user about the same
         */
        if (this.alter && this.create) {
            this.logger.warning('--alter and --create cannot be used together. Ignoring --create');
        }
        /**
         * Entity to create
         */
        const entity = this.app.generators.createEntity(this.name);
        /**
         * The folder for creating the schema file
         */
        const folder = await this.getDirectory((connection.config.migrations || {}).paths);
        const prefix = new Date().getTime();
        const action = this.alter ? 'alter' : 'create';
        const tableName = this.app.generators.tableName(entity.name);
        const fileName = `${prefix}_${action}_${tableName}_table.ts`;
        const codemods = await this.createCodemods();
        await codemods.makeUsingStub(stubsRoot, `make/migration/${action}.stub`, {
            entity,
            flags: this.parsed.flags,
            migration: {
                tableName,
                folder,
                fileName,
            },
        });
    }
}
__decorate([
    args.string({ description: 'Name of the migration file' })
], MakeMigration.prototype, "name", void 0);
__decorate([
    flags.string({
        description: 'Select database connection for which to create the migration',
    })
], MakeMigration.prototype, "connection", void 0);
__decorate([
    flags.string({ description: 'Select migration directory (if multiple sources are configured)' })
], MakeMigration.prototype, "folder", void 0);
__decorate([
    flags.boolean({ description: 'Create a new default (Default action)' })
], MakeMigration.prototype, "create", void 0);
__decorate([
    flags.boolean({ description: 'Alter an existing table' })
], MakeMigration.prototype, "alter", void 0);
