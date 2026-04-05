import {
  SessionClient
} from "../../../chunk-GCO66PQD.js";
import "../../../chunk-TE5JP3SX.js";
import "../../../chunk-5ECC6OWF.js";
import "../../../chunk-PZ5AY32C.js";

// src/plugins/japa/api_client.ts
import lodash from "@poppinss/utils/lodash";
import { configProvider } from "@adonisjs/core";
import { RuntimeException } from "@poppinss/utils";
import { ApiClient, ApiRequest, ApiResponse } from "@japa/api-client";
var sessionApiClient = (app) => {
  const pluginFn = async function() {
    const sessionConfigProvider = app.config.get("session", {});
    const config = await configProvider.resolve(app, sessionConfigProvider);
    if (!config) {
      throw new RuntimeException(
        'Invalid "config/session.ts" file. Make sure you are using the "defineConfig" method'
      );
    }
    ApiRequest.getter(
      "sessionClient",
      function() {
        return new SessionClient(config.stores.memory());
      },
      true
    );
    ApiRequest.macro("withSession", function(data) {
      this.sessionClient.merge(data);
      return this;
    });
    ApiRequest.macro("withFlashMessages", function(data) {
      this.sessionClient.flash(data);
      return this;
    });
    ApiResponse.macro("session", function(key) {
      return key ? lodash.get(this.sessionBag.values, key) : this.sessionBag.values;
    });
    ApiResponse.macro("flashMessages", function() {
      return this.sessionBag.flashMessages;
    });
    ApiResponse.macro("flashMessage", function(key) {
      return lodash.get(this.sessionBag.flashMessages, key);
    });
    ApiResponse.macro("assertSession", function(key, value) {
      this.assert.property(this.session(), key);
      if (value !== void 0) {
        this.assert.deepEqual(this.session(key), value);
      }
    });
    ApiResponse.macro("assertSessionMissing", function(key) {
      this.assert.notProperty(this.session(), key);
    });
    ApiResponse.macro("assertFlashMessage", function(key, value) {
      this.assert.property(this.flashMessages(), key);
      if (value !== void 0) {
        this.assert.deepEqual(this.flashMessage(key), value);
      }
    });
    ApiResponse.macro("assertFlashMissing", function(key) {
      this.assert.notProperty(this.flashMessages(), key);
    });
    ApiResponse.macro("assertHasValidationError", function(field) {
      this.assert.property(this.flashMessage("errors"), field);
    });
    ApiResponse.macro("assertDoesNotHaveValidationError", function(field) {
      this.assert.notProperty(this.flashMessage("errors"), field);
    });
    ApiResponse.macro("assertValidationError", function(field, message) {
      this.assert.include(this.flashMessage("errors")?.[field] || [], message);
    });
    ApiResponse.macro("assertValidationErrors", function(field, messages) {
      this.assert.deepEqual(this.flashMessage("errors")?.[field] || [], messages);
    });
    ApiClient.onRequest((request) => {
      request.setup(async () => {
        request.withCookie(config.cookieName, request.sessionClient.sessionId);
        await request.sessionClient.commit();
        return async (error) => {
          if (error) {
            await request.sessionClient.destroy();
          }
        };
      });
      request.teardown(async (response) => {
        const sessionId = response.cookie(config.cookieName);
        response.sessionBag = sessionId ? await response.request.sessionClient.load(sessionId.value) : {
          values: {},
          flashMessages: {}
        };
        await request.sessionClient.destroy(sessionId?.value);
      });
    });
  };
  return pluginFn;
};
export {
  sessionApiClient
};
//# sourceMappingURL=api_client.js.map