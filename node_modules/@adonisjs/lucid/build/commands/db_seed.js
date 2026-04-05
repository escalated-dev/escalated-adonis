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
import slash from 'slash';
import { extname } from 'node:path';
import { BaseCommand, flags } from '@adonisjs/core/ace';
export default class DbSeed extends BaseCommand {
    static commandName = 'db:seed';
    static description = 'Execute database seeders';
    static options = {
        startApp: true,
    };
    /**
     * Track if one or more seeders have failed
     */
    hasError = false;
    /**
     * Print log message to the console
     */
    printLogMessage(file) {
        const colors = this.colors;
        let color = 'gray';
        let message = '';
        let prefix = '';
        switch (file.status) {
            case 'pending':
                message = 'pending  ';
                color = 'gray';
                break;
            case 'failed':
                message = 'error    ';
                prefix = file.error.message;
                color = 'red';
                break;
            case 'ignored':
                message = 'ignored  ';
                prefix = `Disabled in "${this.app.nodeEnvironment}" environment`;
                color = 'dim';
                break;
            case 'completed':
                message = 'completed';
                color = 'green';
                break;
        }
        this.logger.log(`${colors[color]('❯')} ${colors[color](message)} ${file.file.name}`);
        if (prefix) {
            this.logger.log(`  ${colors[color](prefix)}`);
        }
    }
    /**
     * Not a valid connection
     */
    printNotAValidConnection(connection) {
        this.logger.error(`"${connection}" is not a valid connection name. Double check "config/database" file`);
    }
    /**
     * Print log that the selected seeder file is invalid
     */
    printNotAValidFile(fileName) {
        this.printLogMessage({
            file: {
                name: fileName,
                absPath: fileName,
                getSource: () => { },
            },
            status: 'failed',
            error: new Error('Invalid file path. Pass relative path from the application root'),
        });
    }
    /**
     * Get files cherry picked using either "--interactive" or the
     * "--files" flag
     */
    async getCherryPickedFiles(seedersFiles) {
        if (this.files && this.files.length) {
            return this.files.map((file) => {
                const fileExt = extname(file);
                return (fileExt ? file.replace(fileExt, '') : file).replace(/^\.\/|^\.\\\\/, '');
            });
        }
        else if (this.interactive) {
            return await this.prompt.multiple('Select files to run', seedersFiles.map((file) => {
                return { name: file.name };
            }));
        }
        return seedersFiles.map((file) => file.name);
    }
    /**
     * Instantiate seeders runner
     */
    async instantiateSeeder() {
        const db = await this.app.container.make('lucid.db');
        const { SeedsRunner } = await import('../src/seeders/runner.js');
        this.seeder = new SeedsRunner(db, this.app, this.connection);
    }
    /**
     * Execute selected seeders
     */
    async executedSeeders(selectedSeederFiles, files) {
        const seedersResults = [];
        for (let fileName of selectedSeederFiles) {
            const sourceFile = files.find(({ name }) => slash(fileName) === slash(name));
            if (!sourceFile) {
                this.printNotAValidFile(fileName);
                this.hasError = true;
                return;
            }
            const response = await this.seeder.run(sourceFile);
            if (response.status === 'failed') {
                this.hasError = true;
            }
            if (!this.compactOutput) {
                this.printLogMessage(response);
            }
            seedersResults.push(response);
        }
        return seedersResults;
    }
    /**
     * Print Single-line output when `compact-output` is enabled
     */
    logCompactFinalStatus(seedersResults) {
        const countByStatus = seedersResults.reduce((acc, value) => {
            acc[value.status] = acc[value.status] + 1;
            return acc;
        }, { completed: 0, failed: 0, ignored: 0, pending: 0 });
        let message = `❯ Executed ${countByStatus.completed} seeders`;
        if (countByStatus.failed) {
            message += `, ${countByStatus.failed} failed`;
        }
        if (countByStatus.ignored) {
            message += `, ${countByStatus.ignored} ignored`;
        }
        const color = countByStatus.failed ? 'red' : 'grey';
        this.logger.log(this.colors[color](message));
        if (countByStatus.failed > 0) {
            const erroredSeeder = seedersResults.find((seeder) => seeder.status === 'failed');
            const seederName = this.colors.grey(erroredSeeder.file.name + ':');
            const error = this.colors.red(erroredSeeder.error.message);
            this.logger.log(`${seederName} ${error}\n`);
        }
    }
    /**
     * Run as a subcommand. Never close database connection or exit
     * process here
     */
    async runAsSubCommand() {
        const db = await this.app.container.make('lucid.db');
        this.connection = this.connection || db.primaryConnectionName;
        /**
         * Invalid database connection
         */
        if (!db.manager.has(this.connection)) {
            this.printNotAValidConnection(this.connection);
            this.exitCode = 1;
            return;
        }
        /**
         * Cannot use --files and --interactive together
         */
        if (this.files && this.interactive) {
            this.logger.warning('Cannot use "--interactive" and "--files" together. Ignoring "--interactive"');
        }
        await this.instantiateSeeder();
        const files = await this.seeder.getList();
        const cherryPickedFiles = await this.getCherryPickedFiles(files);
        const result = await this.executedSeeders(cherryPickedFiles, files);
        if (this.compactOutput && result) {
            this.logCompactFinalStatus(result);
        }
        this.exitCode = this.hasError ? 1 : 0;
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
        if (this.seeder && this.isMain) {
            await this.seeder.close();
        }
    }
}
__decorate([
    flags.string({ description: 'Define a custom database connection for the seeders', alias: 'c' })
], DbSeed.prototype, "connection", void 0);
__decorate([
    flags.boolean({ description: 'Run seeders in interactive mode', alias: 'i' })
], DbSeed.prototype, "interactive", void 0);
__decorate([
    flags.array({
        description: 'Define a custom set of seeders files names to run',
        alias: 'f',
    })
], DbSeed.prototype, "files", void 0);
__decorate([
    flags.boolean({ description: 'A compact single-line output' })
], DbSeed.prototype, "compactOutput", void 0);
