import type { UIPrimitives } from '../../types/ace.js';
import { type Router } from '../../modules/http/main.js';
/**
 * Shape of the serialized route specific to the formatter
 */
type SerializedRoute = {
    name: string;
    pattern: string;
    methods: string[];
    middleware: string[];
    handler: {
        type: 'closure';
        name: string;
        args?: string;
    } | {
        type: 'controller';
        moduleNameOrPath: string;
        method: string;
    };
};
/**
 * Routes list formatter is used to format the routes to JSON or an ANSI string
 * with pretty output.
 *
 * The decisions of colors, padding, alignment are all handled by the lists formatter
 */
export declare class RoutesListFormatter {
    #private;
    constructor(router: Router, ui: UIPrimitives, options: {
        displayHeadRoutes?: boolean;
        maxPrettyPrintWidth?: number;
    }, filters: {
        match?: string;
        middleware?: string[];
        ignoreMiddleware?: string[];
    });
    /**
     * Formats routes as an array of objects. Routes are grouped by
     * domain.
     */
    formatAsJSON(): Promise<{
        domain: string;
        routes: SerializedRoute[];
    }[]>;
    /**
     * Format routes to ansi list of tables. Each domain has its own table
     * with heading and rows. Each row has colums with colors and spacing
     * around them.
     */
    formatAsAnsiList(): Promise<{
        heading: string;
        rows: string[];
    }[]>;
    /**
     * Format routes to ansi tables. Each domain has its own table
     * with heading and rows. Each row has colums with colors and spacing
     * around them.
     */
    formatAsAnsiTable(): Promise<{
        heading: string;
        table: ReturnType<UIPrimitives["table"]>;
    }[]>;
}
export {};
