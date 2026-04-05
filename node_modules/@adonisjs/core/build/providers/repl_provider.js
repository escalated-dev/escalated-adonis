/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fsImportAll } from '@poppinss/utils';
import { Repl } from '../modules/repl.js';
/**
 * Resolves a container binding and sets it on the REPL
 * context
 */
async function resolveBindingForRepl(app, repl, binding) {
    repl.server.context[binding] = await app.container.make(binding);
    repl.notify(`Loaded "${binding}" service. You can access it using the "${repl.colors.underline(binding)}" variable`);
}
export default class ReplServiceProvider {
    app;
    constructor(app) {
        this.app = app;
    }
    /**
     * Registers the REPL binding
     */
    register() {
        this.app.container.singleton(Repl, async () => {
            return new Repl({
                historyFilePath: join(homedir(), '.adonisjs_v6_repl_history'),
            });
        });
        this.app.container.alias('repl', Repl);
    }
    /**
     * Registering REPL bindings during provider boot
     */
    async boot() {
        this.app.container.resolving('repl', (repl) => {
            repl.addMethod('importDefault', (_, modulePath) => {
                return this.app.importDefault(modulePath);
            }, {
                description: 'Returns the default export for a module',
            });
            repl.addMethod('importAll', (_, dirPath) => {
                return fsImportAll(this.app.makeURL(dirPath), {
                    ignoreMissingRoot: false,
                });
            }, {
                description: 'Import all files from a directory and assign them to a variable',
            });
            repl.addMethod('make', (_, service, runtimeValues) => {
                return this.app.container.make(service, runtimeValues);
            }, {
                description: 'Make class instance using "container.make" method',
            });
            repl.addMethod('loadApp', () => {
                return resolveBindingForRepl(this.app, repl, 'app');
            }, {
                description: 'Load "app" service in the REPL context',
            });
            repl.addMethod('loadEncryption', () => {
                return resolveBindingForRepl(this.app, repl, 'encryption');
            }, {
                description: 'Load "encryption" service in the REPL context',
            });
            repl.addMethod('loadHash', () => {
                return resolveBindingForRepl(this.app, repl, 'hash');
            }, {
                description: 'Load "hash" service in the REPL context',
            });
            repl.addMethod('loadRouter', () => {
                return resolveBindingForRepl(this.app, repl, 'router');
            }, {
                description: 'Load "router" service in the REPL context',
            });
            repl.addMethod('loadConfig', () => {
                return resolveBindingForRepl(this.app, repl, 'config');
            }, {
                description: 'Load "config" service in the REPL context',
            });
            repl.addMethod('loadTestUtils', () => {
                return resolveBindingForRepl(this.app, repl, 'testUtils');
            }, {
                description: 'Load "testUtils" service in the REPL context',
            });
            repl.addMethod('loadHelpers', async () => {
                const { default: isModule } = await import('../src/helpers/is.js');
                const { default: stringModule } = await import('../src/helpers/string.js');
                const helpers = await import('../src/helpers/main.js');
                repl.server.context.helpers = {
                    string: stringModule,
                    is: isModule,
                    ...helpers,
                };
                repl.notify(`Loaded "helpers" module. You can access it using the "${repl.colors.underline('helpers')}" variable`);
            }, {
                description: 'Load "helpers" module in the REPL context',
            });
        });
    }
}
