import {
  debug_default
} from "../../../chunk-2VRS2VHB.js";
import "../../../chunk-UXA4FHST.js";

// src/plugins/japa/api_client.ts
import { ApiClient, ApiRequest } from "@japa/api-client";
var authApiClient = (app) => {
  const pluginFn = function() {
    debug_default("installing auth api client plugin");
    ApiRequest.macro("loginAs", function(user, ...args) {
      this.authData = {
        guard: "__default__",
        args: [user, ...args]
      };
      return this;
    });
    ApiRequest.macro("withGuard", function(guard) {
      return {
        loginAs: (...args) => {
          this.authData = {
            guard,
            args
          };
          return this;
        }
      };
    });
    ApiClient.setup(async (request) => {
      const auth = await app.container.make("auth.manager");
      const authData = request["authData"];
      if (!authData) {
        return;
      }
      const client = auth.createAuthenticatorClient();
      const guard = authData.guard === "__default__" ? client.use() : client.use(authData.guard);
      const requestData = await guard.authenticateAsClient(
        ...authData.args
      );
      if (requestData.headers) {
        debug_default("defining headers with api client request %O", requestData.headers);
        request.headers(requestData.headers);
      }
      if (requestData.session) {
        debug_default("defining session with api client request %O", requestData.session);
        request.withSession(requestData.session);
      }
      if (requestData.cookies) {
        debug_default("defining session with api client request %O", requestData.session);
        request.cookies(requestData.cookies);
      }
    });
  };
  return pluginFn;
};
export {
  authApiClient
};
