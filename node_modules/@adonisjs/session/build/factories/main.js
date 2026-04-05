import {
  defineConfig
} from "../chunk-OTCKCTXY.js";
import "../chunk-V3OAEXMJ.js";
import "../chunk-G7KFHA57.js";
import {
  SessionMiddleware
} from "../chunk-6BSSM3HO.js";
import "../chunk-XP3CBOXR.js";
import "../chunk-TE5JP3SX.js";
import "../chunk-5ECC6OWF.js";
import "../chunk-PZ5AY32C.js";

// factories/session_middleware_factory.ts
import { Emitter } from "@adonisjs/core/events";
import { AppFactory } from "@adonisjs/core/factories/app";
var SessionMiddlewareFactory = class {
  #config = {
    store: "memory",
    stores: {}
  };
  #emitter;
  #getApp() {
    return new AppFactory().create(new URL("./", import.meta.url), () => {
    });
  }
  #getEmitter() {
    return this.#emitter || new Emitter(this.#getApp());
  }
  /**
   * Merge custom options
   */
  merge(options) {
    if (options.config) {
      this.#config = options.config;
    }
    if (options.emitter) {
      this.#emitter = options.emitter;
    }
    return this;
  }
  /**
   * Creates an instance of the session middleware
   */
  async create() {
    const config = await defineConfig(this.#config).resolver(this.#getApp());
    return new SessionMiddleware(config, this.#getEmitter());
  }
};
export {
  SessionMiddlewareFactory
};
//# sourceMappingURL=main.js.map