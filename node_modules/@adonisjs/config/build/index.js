// src/config.ts
import lodash from "@poppinss/utils/lodash";
var Config = class {
  #config;
  constructor(config = {}) {
    this.#config = config;
  }
  /**
   * Get a tree of config imported from the config directory
   */
  all() {
    return this.#config;
  }
  /**
   * Check if config value exists for a given key
   *
   * ```ts
   * config.has('database.mysql')
   * ```
   */
  has(key) {
    return lodash.has(this.#config, key);
  }
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
  get(key, defaultValue) {
    return lodash.get(this.#config, key, defaultValue);
  }
  /**
   * Define defaults for a config key. The defaults are merged
   * with the value of the config key.
   */
  defaults(key, value) {
    const existingValue = this.get(key);
    if (existingValue !== void 0) {
      lodash.mergeWith(value, existingValue);
    }
    this.set(key, value);
  }
  /**
   * Update value for a key. No changes are made on the disk
   *
   * ```ts
   * config.set('database.host', '127.0.0.1')
   * ```
   */
  set(key, value) {
    lodash.set(this.#config, key, value);
  }
};

// src/loader.ts
import { fsImportAll } from "@poppinss/utils";
var ConfigLoader = class {
  #configDir;
  constructor(configDir) {
    this.#configDir = configDir;
  }
  /**
   * Load config files as a tree from a given path.
   */
  load() {
    return fsImportAll(this.#configDir, {
      ignoreMissingRoot: true
    });
  }
};
export {
  Config,
  ConfigLoader
};
