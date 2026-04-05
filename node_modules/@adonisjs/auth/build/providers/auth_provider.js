import {
  AuthManager
} from "../chunk-SAW2RPCA.js";
import "../chunk-2VRS2VHB.js";
import "../chunk-MUPAP5IP.js";
import "../chunk-UXA4FHST.js";

// providers/auth_provider.ts
import { configProvider } from "@adonisjs/core";
import { RuntimeException } from "@poppinss/utils";
var AuthProvider = class {
  constructor(app) {
    this.app = app;
  }
  register() {
    this.app.container.singleton("auth.manager", async () => {
      const authConfigProvider = this.app.config.get("auth");
      const config = await configProvider.resolve(this.app, authConfigProvider);
      if (!config) {
        throw new RuntimeException(
          'Invalid config exported from "config/auth.ts" file. Make sure to use the defineConfig method'
        );
      }
      return new AuthManager(config);
    });
  }
};
export {
  AuthProvider as default
};
