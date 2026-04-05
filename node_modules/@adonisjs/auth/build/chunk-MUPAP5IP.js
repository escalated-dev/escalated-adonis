import {
  __export
} from "./chunk-UXA4FHST.js";

// src/errors.ts
var errors_exports = {};
__export(errors_exports, {
  E_INVALID_CREDENTIALS: () => E_INVALID_CREDENTIALS,
  E_UNAUTHORIZED_ACCESS: () => E_UNAUTHORIZED_ACCESS
});
import { Exception } from "@adonisjs/core/exceptions";
var E_UNAUTHORIZED_ACCESS = class extends Exception {
  static status = 401;
  static code = "E_UNAUTHORIZED_ACCESS";
  /**
   * Endpoint to redirect to. Only used by "session" driver
   * renderer
   */
  redirectTo;
  /**
   * Translation identifier. Can be customized
   */
  identifier = "errors.E_UNAUTHORIZED_ACCESS";
  /**
   * The guard name reference that raised the exception. It allows
   * us to customize the logic of handling the exception.
   */
  guardDriverName;
  /**
   * A collection of renderers to render the exception to a
   * response.
   *
   * The collection is a key-value pair, where the key is
   * the guard driver name and value is a factory function
   * to respond to the request.
   */
  renderers = {
    /**
     * Response when session driver is used
     */
    session: (message, error, ctx) => {
      switch (ctx.request.accepts(["html", "application/vnd.api+json", "json"])) {
        case "html":
        case null:
          ctx.session.flashExcept(["_csrf"]);
          ctx.session.flashErrors({ [error.code]: message });
          ctx.response.redirect(error.redirectTo || "/", true);
          break;
        case "json":
          ctx.response.status(error.status).send({
            errors: [
              {
                message
              }
            ]
          });
          break;
        case "application/vnd.api+json":
          ctx.response.status(error.status).send({
            errors: [
              {
                code: error.code,
                title: message
              }
            ]
          });
          break;
      }
    },
    /**
     * Response when basic auth driver is used
     */
    basic_auth: (message, _, ctx) => {
      ctx.response.status(this.status).header("WWW-Authenticate", `Basic realm="Authenticate", charset="UTF-8"`).send(message);
    },
    /**
     * Response when access tokens driver is used
     */
    access_tokens: (message, error, ctx) => {
      switch (ctx.request.accepts(["html", "application/vnd.api+json", "json"])) {
        case "html":
        case null:
          ctx.response.status(error.status).send(message);
          break;
        case "json":
          ctx.response.status(error.status).send({
            errors: [
              {
                message
              }
            ]
          });
          break;
        case "application/vnd.api+json":
          ctx.response.status(error.status).send({
            errors: [
              {
                code: error.code,
                title: message
              }
            ]
          });
          break;
      }
    }
  };
  /**
   * Returns the message to be sent in the HTTP response.
   * Feel free to override this method and return a custom
   * response.
   */
  getResponseMessage(error, ctx) {
    if ("i18n" in ctx) {
      return ctx.i18n.t(error.identifier, {}, error.message);
    }
    return error.message;
  }
  constructor(message, options) {
    super(message, {});
    this.guardDriverName = options.guardDriverName;
    this.redirectTo = options.redirectTo;
  }
  /**
   * Converts exception to an HTTP response
   */
  async handle(error, ctx) {
    const renderer = this.renderers[this.guardDriverName];
    const message = error.getResponseMessage(error, ctx);
    if (!renderer) {
      return ctx.response.status(error.status).send(message);
    }
    return renderer(message, error, ctx);
  }
};
var E_INVALID_CREDENTIALS = class extends Exception {
  static status = 400;
  static code = "E_INVALID_CREDENTIALS";
  /**
   * Translation identifier. Can be customized
   */
  identifier = "errors.E_INVALID_CREDENTIALS";
  /**
   * Returns the message to be sent in the HTTP response.
   * Feel free to override this method and return a custom
   * response.
   */
  getResponseMessage(error, ctx) {
    if ("i18n" in ctx) {
      return ctx.i18n.t(error.identifier, {}, error.message);
    }
    return error.message;
  }
  /**
   * Converts exception to an HTTP response
   */
  async handle(error, ctx) {
    const message = this.getResponseMessage(error, ctx);
    switch (ctx.request.accepts(["html", "application/vnd.api+json", "json"])) {
      case "html":
      case null:
        if (ctx.session) {
          ctx.session.flashExcept(["_csrf", "_method", "password", "password_confirmation"]);
          ctx.session.flashErrors({ [error.code]: message });
          ctx.response.redirect("back", true);
        } else {
          ctx.response.status(error.status).send(message);
        }
        break;
      case "json":
        ctx.response.status(error.status).send({
          errors: [
            {
              message
            }
          ]
        });
        break;
      case "application/vnd.api+json":
        ctx.response.status(error.status).send({
          errors: [
            {
              code: error.code,
              title: message
            }
          ]
        });
        break;
    }
  }
};

export {
  E_UNAUTHORIZED_ACCESS,
  E_INVALID_CREDENTIALS,
  errors_exports
};
