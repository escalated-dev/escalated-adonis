// src/plugins/japa/api_client.ts
import { configProvider } from "@adonisjs/core";
import { RuntimeException } from "@poppinss/utils";
import { ApiRequest, ApiResponse } from "@japa/api-client";
function ensureIsInertiaResponse() {
  if (!this.header("x-inertia")) {
    throw new Error(
      "Response is not an Inertia response. Make sure to call `withInertia()` on the request"
    );
  }
}
function inertiaApiClient(app) {
  return async () => {
    const inertiaConfigProvider = app.config.get("inertia");
    const config = await configProvider.resolve(app, inertiaConfigProvider);
    if (!config) {
      throw new RuntimeException(
        'Invalid "config/inertia.ts" file. Make sure you are using the "defineConfig" method'
      );
    }
    ApiRequest.macro("withInertia", function() {
      this.header("x-inertia", "true");
      this.header("x-inertia-version", config.versionCache.getVersion().toString());
      return this;
    });
    ApiRequest.macro(
      "withInertiaPartialReload",
      function(component, data) {
        this.withInertia();
        this.header("X-Inertia-Partial-Data", data.join(","));
        this.header("X-Inertia-Partial-Component", component);
        return this;
      }
    );
    ApiResponse.getter("inertiaComponent", function() {
      ensureIsInertiaResponse.call(this);
      return this.body().component;
    });
    ApiResponse.getter("inertiaProps", function() {
      ensureIsInertiaResponse.call(this);
      return this.body().props;
    });
    ApiResponse.macro("assertInertiaComponent", function(component) {
      ensureIsInertiaResponse.call(this);
      this.assert.deepEqual(this.body().component, component);
      return this;
    });
    ApiResponse.macro(
      "assertInertiaProps",
      function(props) {
        this.ensureHasAssert();
        ensureIsInertiaResponse.call(this);
        this.assert.deepEqual(this.body().props, props);
        return this;
      }
    );
    ApiResponse.macro(
      "assertInertiaPropsContains",
      function(props) {
        this.ensureHasAssert();
        ensureIsInertiaResponse.call(this);
        this.assert.containsSubset(this.body().props, props);
        return this;
      }
    );
  };
}
export {
  inertiaApiClient
};
