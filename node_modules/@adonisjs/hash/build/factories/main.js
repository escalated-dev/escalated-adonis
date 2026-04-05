import {
  HashManager
} from "../chunk-RHMXMP27.js";
import {
  Scrypt
} from "../chunk-WB54OA6N.js";
import "../chunk-7RS6HCBK.js";
import "../chunk-JSA56AE7.js";
import "../chunk-JSBRDJBE.js";

// factories/hash_manager.ts
var HashManagerFactory = class _HashManagerFactory {
  /**
   * Config accepted by hash manager
   */
  #config;
  constructor(config) {
    this.#config = config || {
      default: "scrypt",
      list: {
        scrypt: () => new Scrypt({})
      }
    };
  }
  /**
   * Merge factory parameters
   */
  merge(config) {
    return new _HashManagerFactory(config);
  }
  /**
   * Create hash manager instance
   */
  create() {
    return new HashManager(this.#config);
  }
};
export {
  HashManagerFactory
};
