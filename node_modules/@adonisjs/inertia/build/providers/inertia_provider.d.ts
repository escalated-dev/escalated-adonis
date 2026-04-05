import { Route } from '@adonisjs/core/http';
import { ApplicationService } from '@adonisjs/core/types';

declare module '@adonisjs/core/http' {
    interface BriskRoute {
        /**
         * Render an inertia page without defining an
         * explicit route handler
         */
        renderInertia(component: string, props?: Record<string, any>, viewProps?: Record<string, any>): Route;
    }
}
/**
 * Inertia provider
 */
declare class InertiaProvider {
    protected app: ApplicationService;
    constructor(app: ApplicationService);
    /**
     * Registers edge plugin when edge is installed
     */
    protected registerEdgePlugin(): Promise<void>;
    /**
     * Register inertia middleware
     */
    register(): Promise<void>;
    /**
     * Register edge plugin and brisk route macro
     */
    boot(): Promise<void>;
}

export { InertiaProvider as default };
