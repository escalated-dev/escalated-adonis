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
import { args, BaseCommand, flags } from '../../modules/ace/main.js';
import { RoutesListFormatter } from '../../src/cli_formatters/routes_list.js';
/**
 * The list routes command is used to view the list of registered routes
 */
export default class ListRoutes extends BaseCommand {
    static commandName = 'list:routes';
    static description = 'List application routes. This command will boot the application in the console environment';
    /**
     * Making sure to start the application so that the routes are
     * imported
     */
    static options = {
        startApp: true,
    };
    async run() {
        const router = await this.app.container.make('router');
        const formatter = new RoutesListFormatter(router, this.ui, {}, {
            ignoreMiddleware: this.ignoreMiddleware,
            middleware: this.middleware,
            match: this.match,
        });
        /**
         * Display as JSON
         */
        if (this.json) {
            this.logger.log(JSON.stringify(await formatter.formatAsJSON(), null, 2));
            return;
        }
        /**
         * Display as a standard table
         */
        if (this.table) {
            const tables = await formatter.formatAsAnsiTable();
            tables.forEach((table) => {
                this.logger.log('');
                if (table.heading) {
                    this.logger.log(table.heading);
                    this.logger.log('');
                }
                table.table.render();
            });
            return;
        }
        /**
         * Display as a list
         */
        const list = await formatter.formatAsAnsiList();
        list.forEach((item) => {
            this.logger.log('');
            if (item.heading) {
                this.logger.log(item.heading);
                this.logger.log('');
            }
            this.logger.log(item.rows.join('\n'));
        });
    }
}
__decorate([
    args.string({
        description: 'Find routes matching the given keyword. Route name, pattern and controller name will be searched against the keyword',
        required: false,
    })
], ListRoutes.prototype, "match", void 0);
__decorate([
    flags.array({
        description: 'View routes that includes all the mentioned middleware names. Use * to see routes that are using one or more middleware',
    })
], ListRoutes.prototype, "middleware", void 0);
__decorate([
    flags.array({
        description: 'View routes that does not include all the mentioned middleware names. Use * to see routes that are using zero middleware',
    })
], ListRoutes.prototype, "ignoreMiddleware", void 0);
__decorate([
    flags.boolean({ description: 'Get routes list as a JSON string' })
], ListRoutes.prototype, "json", void 0);
__decorate([
    flags.boolean({ description: 'View list of routes as a table' })
], ListRoutes.prototype, "table", void 0);
