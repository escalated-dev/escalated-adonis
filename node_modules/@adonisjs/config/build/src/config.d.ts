/**
 * Config module eases the process of using configuration inside your AdonisJS
 * applications.
 *
 * The config files are stored inside a dedicated directory, which are loaded and cached
 * on application boot. Later you can access the values using the `dot` syntax.
 *
 * ## Access values
 *
 * 1. **Given the config file is stored as `config/app.ts` with following content**
 *
 * ```js
 * module.exports = {
 *  appKey: ''
 * }
 * ```
 *
 * 2. **You access the appKey as follows**
 *
 * ```js
 * const config = new Config(configTree)
 * config.get('app.appKey')
 * ```
 */
export declare class Config {
    #private;
    constructor(config?: Record<any, any>);
    /**
     * Get a tree of config imported from the config directory
     */
    all(): Record<any, any>;
    /**
     * Check if config value exists for a given key
     *
     * ```ts
     * config.has('database.mysql')
     * ```
     */
    has(key: string): boolean;
    /**
     * Read value from the config. Make use of the `dot notation`
     * syntax to read nested values.
     *
     * The `defaultValue` is returned when the original value
     * is `undefined`.
     *
     * ```ts
     * config.get('database.mysql')
     * ```
     */
    get<T>(key: string, defaultValue?: any): T;
    /**
     * Define defaults for a config key. The defaults are merged
     * with the value of the config key.
     */
    defaults(key: string, value: any): void;
    /**
     * Update value for a key. No changes are made on the disk
     *
     * ```ts
     * config.set('database.host', '127.0.0.1')
     * ```
     */
    set(key: string, value: any): void;
}
