import type { CommandOptions } from '../../types/ace.js';
import { BaseCommand } from '../../modules/ace/main.js';
/**
 * The list routes command is used to view the list of registered routes
 */
export default class ListRoutes extends BaseCommand {
    static commandName: string;
    static description: string;
    /**
     * Making sure to start the application so that the routes are
     * imported
     */
    static options: CommandOptions;
    /**
     * The match filter is used to find route by name, pattern and controller name that
     * includes the match keyword
     */
    match: string;
    /**
     * The middleware flag searches for the routes using all the mentioned middleware
     */
    middleware: string[];
    /**
     * The ignoreMiddleware flag searches for the routes not using all the mentioned middleware
     */
    ignoreMiddleware: string[];
    /**
     * The json flag is used to view list of routes as a JSON string.
     */
    json: boolean;
    /**
     * The table flag is used to view list of routes as a classic CLI table
     */
    table: boolean;
    run(): Promise<void>;
}
