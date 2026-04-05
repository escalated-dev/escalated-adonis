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
import { BaseCommand, flags, args } from '../modules/ace/main.js';
import { detectAssetsBundler, importAssembler, importTypeScript } from '../src/internal_helpers.js';
/**
 * Test command is used to run tests with optional file watcher. Under the
 * hood, we run "bin/test.js" file.
 */
export default class Test extends BaseCommand {
    static commandName = 'test';
    static description = 'Run tests along with the file watcher to re-run tests on file change';
    static options = {
        allowUnknownFlags: true,
        staysAlive: true,
    };
    /**
     * Log a development dependency is missing
     */
    #logMissingDevelopmentDependency(dependency) {
        this.logger.error([
            `Cannot find package "${dependency}"`,
            '',
            `The "${dependency}" package is a development dependency and therefore you should run tests with development dependencies installed.`,
            '',
            'If you are run tests inside a CI, make sure the NODE_ENV is set to "development"',
        ].join('\n'));
    }
    /**
     * Collection of unknown flags to pass to Japa
     */
    #getPassthroughFlags() {
        return this.parsed.unknownFlags
            .map((flag) => {
            const value = this.parsed.flags[flag];
            /**
             * Not mentioning value when value is "true"
             */
            if (value === true) {
                return [`--${flag}`];
            }
            /**
             * Repeating flag multiple times when value is an array
             */
            if (Array.isArray(value)) {
                return value.map((v) => [`--${flag}`, v]);
            }
            return [`--${flag}`, value];
        })
            .flat(2);
    }
    /**
     * Returns the assets bundler config
     */
    async #getAssetsBundlerConfig() {
        const assetsBundler = await detectAssetsBundler(this.app);
        return assetsBundler
            ? {
                enabled: this.assets === false ? false : true,
                driver: assetsBundler.name,
                cmd: assetsBundler.devServer.command,
                args: (assetsBundler.devServer.args || []).concat(this.assetsArgs || []),
            }
            : {
                enabled: false,
            };
    }
    /**
     * Runs tests
     */
    async run() {
        process.env.NODE_ENV = 'test';
        const assembler = await importAssembler(this.app);
        if (!assembler) {
            this.#logMissingDevelopmentDependency('@adonisjs/assembler');
            this.exitCode = 1;
            return;
        }
        this.testsRunner = new assembler.TestRunner(this.app.appRoot, {
            clearScreen: this.clear === false ? false : true,
            nodeArgs: this.parsed.nodeArgs,
            scriptArgs: this.#getPassthroughFlags(),
            assets: await this.#getAssetsBundlerConfig(),
            filters: {
                suites: this.suites,
                files: this.files,
                groups: this.groups,
                tags: this.tags,
                tests: this.tests,
            },
            failed: this.failed,
            retries: this.retries,
            timeout: this.timeout,
            reporters: this.reporters,
            suites: this.app.rcFile.tests.suites.map((suite) => {
                return {
                    name: suite.name,
                    files: suite.files,
                };
            }),
            env: {
                NODE_ENV: 'test',
            },
            metaFiles: this.app.rcFile.metaFiles,
        });
        /**
         * Share command logger with assembler, so that CLI flags like --no-ansi has
         * similar impact for assembler logs as well.
         */
        this.testsRunner.setLogger(this.logger);
        /**
         * Exit command when the test runner is closed
         */
        this.testsRunner.onClose((exitCode) => {
            this.exitCode = exitCode;
            this.terminate();
        });
        /**
         * Exit command when the dev server crashes
         */
        this.testsRunner.onError(() => {
            this.exitCode = 1;
            this.terminate();
        });
        /**
         * Start the test runner in watch mode
         */
        if (this.watch) {
            const ts = await importTypeScript(this.app);
            if (!ts) {
                this.#logMissingDevelopmentDependency('typescript');
                this.exitCode = 1;
                return;
            }
            await this.testsRunner.runAndWatch(ts, { poll: this.poll || false });
        }
        else {
            await this.testsRunner.run();
        }
    }
}
__decorate([
    args.spread({
        description: 'Mention suite names to run tests for selected suites',
        required: false,
    })
], Test.prototype, "suites", void 0);
__decorate([
    flags.array({ description: 'Filter tests by the filename' })
], Test.prototype, "files", void 0);
__decorate([
    flags.array({ description: 'Filter tests by tags' })
], Test.prototype, "tags", void 0);
__decorate([
    flags.array({ description: 'Filter tests by parent group title' })
], Test.prototype, "groups", void 0);
__decorate([
    flags.array({ description: 'Filter tests by test title' })
], Test.prototype, "tests", void 0);
__decorate([
    flags.array({ description: 'Activate one or more test reporters' })
], Test.prototype, "reporters", void 0);
__decorate([
    flags.boolean({ description: 'Watch filesystem and re-run tests on file change' })
], Test.prototype, "watch", void 0);
__decorate([
    flags.boolean({ description: 'Use polling to detect filesystem changes' })
], Test.prototype, "poll", void 0);
__decorate([
    flags.number({ description: 'Define default timeout for all tests' })
], Test.prototype, "timeout", void 0);
__decorate([
    flags.number({ description: 'Define default retries for all tests' })
], Test.prototype, "retries", void 0);
__decorate([
    flags.boolean({ description: 'Execute tests failed during the last run' })
], Test.prototype, "failed", void 0);
__decorate([
    flags.boolean({
        description: 'Clear the terminal for new logs after file change',
        showNegatedVariantInHelp: true,
        default: true,
    })
], Test.prototype, "clear", void 0);
__decorate([
    flags.boolean({
        description: 'Start assets bundler dev server.',
        showNegatedVariantInHelp: true,
        default: true,
    })
], Test.prototype, "assets", void 0);
__decorate([
    flags.array({
        description: 'Define CLI arguments to pass to the assets bundler',
    })
], Test.prototype, "assetsArgs", void 0);
