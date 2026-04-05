import { type Edge } from 'edge.js';
import type { ApplicationService } from '../src/types.js';
import { type Route } from '../modules/http/main.js';
declare module '@adonisjs/core/http' {
    interface HttpContext {
        /**
         * Reference to the edge renderer to render templates
         * during an HTTP request
         */
        view: ReturnType<Edge['createRenderer']>;
    }
    interface BriskRoute {
        /**
         * Render an edge template without defining an
         * explicit route handler
         */
        render(template: string, data?: Record<string, any>): Route;
    }
}
/**
 * The Edge service provider configures Edge to work within
 * an AdonisJS application environment
 */
export default class EdgeServiceProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    /**
     * Bridge AdonisJS and Edge
     */
    boot(): Promise<void>;
}
