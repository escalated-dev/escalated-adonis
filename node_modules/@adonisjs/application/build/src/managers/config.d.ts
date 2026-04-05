import { Config } from '@adonisjs/config';
/**
 * Env manager is used to load, parse, validate and set environment
 * variables.
 */
export declare class ConfigManager {
    #private;
    /**
     * Reference to the config class. The value is defined
     * after the "init" method call
     */
    config: Config;
    constructor(appRoot: URL);
    /**
     * Define the config values to use when booting the
     * config provider. Calling this method disables
     * reading files from the config directory.
     */
    useConfig(values: Record<any, any>): this;
    /**
     * Process config values.
     */
    process(configDirectory: string): Promise<void>;
}
