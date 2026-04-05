/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import edge from 'edge.js';
import { pluginEdgeDumper } from '../modules/dumper/plugins/edge.js';
import { BriskRoute, HttpContext } from '../modules/http/main.js';
/**
 * The Edge service provider configures Edge to work within
 * an AdonisJS application environment
 */
export default class EdgeServiceProvider {
    app;
    constructor(app) {
        this.app = app;
        this.app.usingEdgeJS = true;
    }
    /**
     * Bridge AdonisJS and Edge
     */
    async boot() {
        const app = this.app;
        const router = await this.app.container.make('router');
        const dumper = await this.app.container.make('dumper');
        function edgeConfigResolver(key, defaultValue) {
            return app.config.get(key, defaultValue);
        }
        edgeConfigResolver.has = function (key) {
            return app.config.has(key);
        };
        /**
         * Mount the default disk
         */
        edge.mount(app.viewsPath());
        /**
         * Cache templates in production
         */
        edge.configure({ cache: app.inProduction });
        /**
         * Define Edge global helpers
         */
        edge.global('route', function (...args) {
            return router.makeUrl(...args);
        });
        edge.global('signedRoute', function (...args) {
            return router.makeSignedUrl(...args);
        });
        edge.global('app', app);
        edge.global('config', edgeConfigResolver);
        /**
         * Creating a isolated instance of edge renderer
         */
        HttpContext.getter('view', function () {
            return edge.createRenderer().share({
                request: this.request,
            });
        }, true);
        /**
         * Adding brisk route to render templates without an
         * explicit handler
         */
        BriskRoute.macro('render', function (template, data) {
            function rendersTemplate({ view }) {
                return view.render(template, data);
            }
            Object.defineProperty(rendersTemplate, 'listArgs', { value: template, writable: false });
            return this.setHandler(rendersTemplate);
        });
        edge.use(pluginEdgeDumper(dumper));
    }
}
