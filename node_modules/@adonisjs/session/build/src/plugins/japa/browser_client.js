import {
  SessionClient
} from "../../../chunk-GCO66PQD.js";
import "../../../chunk-TE5JP3SX.js";
import "../../../chunk-5ECC6OWF.js";
import "../../../chunk-PZ5AY32C.js";

// src/plugins/japa/browser_client.ts
import { configProvider } from "@adonisjs/core";
import { RuntimeException } from "@poppinss/utils";
import { decoratorsCollection } from "@japa/browser-client";
function transformSameSiteOption(sameSite) {
  if (!sameSite) {
    return;
  }
  if (sameSite === true || sameSite === "strict") {
    return "Strict";
  }
  if (sameSite === "lax") {
    return "Lax";
  }
  if (sameSite === "none") {
    return "None";
  }
}
function getSessionCookieOptions(config, cookieOptions) {
  const options = { ...config.cookie, ...cookieOptions };
  return {
    ...options,
    expires: void 0,
    sameSite: transformSameSiteOption(options.sameSite)
  };
}
var sessionBrowserClient = (app) => {
  const pluginFn = async function() {
    const sessionConfigProvider = app.config.get("session", {});
    const config = await configProvider.resolve(app, sessionConfigProvider);
    if (!config) {
      throw new RuntimeException(
        'Invalid "config/session.ts" file. Make sure you are using the "defineConfig" method'
      );
    }
    decoratorsCollection.register({
      context(context) {
        context.sessionClient = new SessionClient(config.stores.memory());
        context.initiateSession = async function(options) {
          const sessionId = await context.getCookie(config.cookieName);
          if (sessionId) {
            context.sessionClient.sessionId = sessionId;
            return;
          }
          await context.setCookie(
            config.cookieName,
            context.sessionClient.sessionId,
            getSessionCookieOptions(config, options)
          );
        };
        context.getSession = async function() {
          await context.initiateSession();
          const sessionData = await context.sessionClient.load();
          return sessionData.values;
        };
        context.getFlashMessages = async function() {
          await context.initiateSession();
          const sessionData = await context.sessionClient.load();
          return sessionData.flashMessages;
        };
        context.setSession = async function(values) {
          await context.initiateSession();
          context.sessionClient.merge(values);
          await context.sessionClient.commit();
        };
        context.setFlashMessages = async function(values) {
          await context.initiateSession();
          context.sessionClient.flash(values);
          await context.sessionClient.commit();
        };
        context.on("close", async function() {
          await context.sessionClient.destroy();
        });
      }
    });
  };
  return pluginFn;
};
export {
  sessionBrowserClient
};
//# sourceMappingURL=browser_client.js.map