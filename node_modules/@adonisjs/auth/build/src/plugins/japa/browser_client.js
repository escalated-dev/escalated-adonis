import {
  debug_default
} from "../../../chunk-2VRS2VHB.js";
import "../../../chunk-UXA4FHST.js";

// src/plugins/japa/browser_client.ts
import { decoratorsCollection } from "@japa/browser-client";
import { RuntimeException } from "@adonisjs/core/exceptions";
var authBrowserClient = (app) => {
  const pluginFn = async function() {
    debug_default("installing auth browser client plugin");
    const auth = await app.container.make("auth.manager");
    decoratorsCollection.register({
      context(context) {
        context.withGuard = function(guardName) {
          return {
            async loginAs(...args) {
              const client = auth.createAuthenticatorClient();
              const guard = client.use(guardName);
              const requestData = await guard.authenticateAsClient(
                ...args
              );
              if (requestData.headers) {
                throw new RuntimeException(
                  `Cannot use "${guard.driverName}" guard with browser client`
                );
              }
              if (requestData.cookies) {
                debug_default("defining cookies with browser context %O", requestData.cookies);
                Object.keys(requestData.cookies).forEach((cookie) => {
                  context.setCookie(cookie, requestData.cookies[cookie]);
                });
              }
              if (requestData.session) {
                debug_default("defining session with browser context %O", requestData.session);
                context.setSession(requestData.session);
              }
            }
          };
        };
        context.loginAs = async function(user, ...args) {
          const client = auth.createAuthenticatorClient();
          const guard = client.use();
          const requestData = await guard.authenticateAsClient(user, ...args);
          if (requestData.headers) {
            throw new RuntimeException(`Cannot use "${guard.driverName}" guard with browser client`);
          }
          if (requestData.cookies) {
            debug_default("defining cookies with browser context %O", requestData.cookies);
            Object.keys(requestData.cookies).forEach((cookie) => {
              context.setCookie(cookie, requestData.cookies[cookie]);
            });
          }
          if (requestData.session) {
            debug_default("defining session with browser context %O", requestData.session);
            context.setSession(requestData.session);
          }
        };
      }
    });
  };
  return pluginFn;
};
export {
  authBrowserClient
};
