import {
  SessionCollection
} from "../chunk-G7KFHA57.js";
import {
  SessionMiddleware
} from "../chunk-6BSSM3HO.js";
import "../chunk-XP3CBOXR.js";
import "../chunk-TE5JP3SX.js";
import "../chunk-5ECC6OWF.js";
import "../chunk-PZ5AY32C.js";

// providers/session_provider.ts
import { configProvider } from "@adonisjs/core";
import { RuntimeException } from "@poppinss/utils";
var SessionProvider = class {
  constructor(app) {
    this.app = app;
  }
  /**
   * Registers edge plugin when edge is installed
   * in the user application.
   */
  async registerEdgePlugin() {
    if (this.app.usingEdgeJS) {
      const edge = await import("edge.js");
      const { edgePluginSession } = await import("../src/plugins/edge.js");
      edge.default.use(edgePluginSession);
    }
  }
  /**
   * Resolves the session config from the config provider
   */
  async #resolveConfig() {
    const sessionConfigProvider = this.app.config.get("session", {});
    const config = await configProvider.resolve(this.app, sessionConfigProvider);
    if (!config) {
      throw new RuntimeException(
        'Invalid "config/session.ts" file. Make sure you are using the "defineConfig" method'
      );
    }
    return config;
  }
  /**
   * Registering bindings
   */
  register() {
    this.app.container.singleton(SessionMiddleware, async (resolver) => {
      const config = await this.#resolveConfig();
      const emitter = await resolver.make("emitter");
      return new SessionMiddleware(config, emitter);
    });
    this.app.container.singleton(SessionCollection, async () => {
      const config = await this.#resolveConfig();
      return new SessionCollection(config);
    });
  }
  /**
   * Adding edge tags (if edge is installed)
   */
  async boot() {
    await this.registerEdgePlugin();
  }
};
export {
  SessionProvider as default
};
//# sourceMappingURL=session_provider.js.map