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
import { BaseCommand, flags } from '../modules/ace/main.js';
import { detectAssetsBundler, importAssembler, importTypeScript } from '../src/internal_helpers.js';
/**
 * Serve command is used to run the AdonisJS HTTP server during development. The
 * command under the hood runs the "bin/server.ts" file and watches for file
 * system changes
 */
export default class Serve extends BaseCommand {
    static commandName = 'serve';
    static description = 'Start the development HTTP server along with the file watcher to perform restarts on file change';
    static help = [
        'Start the development server with file watcher using the following command.',
        '```',
        '{{ binaryName }} serve --watch',
        '```',
        '',
        'You can also start the server with HMR support using the following command.',
        '```',
        '{{ binaryName }} serve --hmr',
        '```',
        '',
        'The assets bundler dev server runs automatically after detecting vite config or webpack config files',
        'You may pass vite CLI args using the --assets-args command line flag.',
        '```',
        '{{ binaryName }} serve --assets-args="--debug --base=/public"',
        '```',
    ];
    static options = {
        staysAlive: true,
    };
    /**
     * Log a development dependency is missing
     */
    #logMissingDevelopmentDependency(dependency) {
        this.logger.error([
            `Cannot find package "${dependency}"`,
            '',
            `The "${dependency}" package is a development dependency and therefore you should use the serve command during development only.`,
            '',
            'If you are running your application in production, then use "node bin/server.js" command to start the HTTP server',
        ].join('\n'));
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
     * Runs the HTTP server
     */
    async run() {
        const assembler = await importAssembler(this.app);
        if (!assembler) {
            this.#logMissingDevelopmentDependency('@adonisjs/assembler');
            this.exitCode = 1;
            return;
        }
        if (this.watch && this.hmr) {
            this.logger.error('Cannot use --watch and --hmr flags together. Choose one of them');
            this.exitCode = 1;
            return;
        }
        this.devServer = new assembler.DevServer(this.app.appRoot, {
            hmr: this.hmr === true ? true : false,
            clearScreen: this.clear === false ? false : true,
            nodeArgs: this.parsed.nodeArgs,
            scriptArgs: [],
            assets: await this.#getAssetsBundlerConfig(),
            metaFiles: this.app.rcFile.metaFiles,
            hooks: {
                onDevServerStarted: this.app.rcFile.hooks?.onDevServerStarted,
                onSourceFileChanged: this.app.rcFile.hooks?.onSourceFileChanged,
            },
        });
        /**
         * Share command logger with assembler, so that CLI flags like --no-ansi has
         * similar impact for assembler logs as well.
         */
        this.devServer.setLogger(this.logger);
        /**
         * Exit command when the dev server is closed
         */
        this.devServer.onClose((exitCode) => {
            this.exitCode = exitCode;
            this.terminate();
        });
        /**
         * Exit command when the dev server crashes
         */
        this.devServer.onError(() => {
            this.exitCode = 1;
            this.terminate();
        });
        /**
         * Start the development server
         */
        if (this.watch) {
            const ts = await importTypeScript(this.app);
            if (!ts) {
                this.#logMissingDevelopmentDependency('typescript');
                this.exitCode = 1;
                return;
            }
            await this.devServer.startAndWatch(ts, { poll: this.poll || false });
        }
        else {
            await this.devServer.start();
        }
    }
}
__decorate([
    flags.boolean({ description: 'Start the server with HMR support' })
], Serve.prototype, "hmr", void 0);
__decorate([
    flags.boolean({
        description: 'Watch filesystem and restart the HTTP server on file change',
        alias: 'w',
    })
], Serve.prototype, "watch", void 0);
__decorate([
    flags.boolean({ description: 'Use polling to detect filesystem changes', alias: 'p' })
], Serve.prototype, "poll", void 0);
__decorate([
    flags.boolean({
        description: 'Clear the terminal for new logs after file change',
        showNegatedVariantInHelp: true,
        default: true,
    })
], Serve.prototype, "clear", void 0);
__decorate([
    flags.boolean({
        description: 'Start assets bundler dev server',
        showNegatedVariantInHelp: true,
        default: true,
    })
], Serve.prototype, "assets", void 0);
__decorate([
    flags.array({
        description: 'Define CLI arguments to pass to the assets bundler',
    })
], Serve.prototype, "assetsArgs", void 0);
