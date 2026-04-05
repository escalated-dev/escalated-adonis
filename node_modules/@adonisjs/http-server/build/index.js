import {
  BriskRoute,
  CookieClient,
  E_CANNOT_LOOKUP_ROUTE,
  E_HTTP_EXCEPTION,
  E_HTTP_REQUEST_ABORTED,
  E_ROUTE_NOT_FOUND,
  HttpContext,
  Redirect,
  Request,
  Response,
  ResponseStatus,
  Route,
  RouteGroup,
  RouteResource,
  Router,
  Server,
  defineConfig,
  exceptions_exports,
  parseRange
} from "./chunk-OLJ72AJE.js";

// src/exception_handler.ts
import is from "@sindresorhus/is";
import Macroable from "@poppinss/macroable";
var ExceptionHandler = class extends Macroable {
  /**
   * Computed from the status pages property
   */
  #expandedStatusPages;
  /**
   * Whether or not to render debug info. When set to true, the errors
   * will have the complete error stack.
   */
  debug = process.env.NODE_ENV !== "production";
  /**
   * Whether or not to render status pages. When set to true, the unhandled
   * errors with matching status codes will be rendered using a status
   * page.
   */
  renderStatusPages = process.env.NODE_ENV === "production";
  /**
   * A collection of error status code range and the view to render.
   */
  statusPages = {};
  /**
   * Enable/disable errors reporting
   */
  reportErrors = true;
  /**
   * An array of exception classes to ignore when
   * reporting an error
   */
  ignoreExceptions = [
    E_HTTP_EXCEPTION,
    E_ROUTE_NOT_FOUND,
    E_CANNOT_LOOKUP_ROUTE,
    E_HTTP_REQUEST_ABORTED
  ];
  /**
   * An array of HTTP status codes to ignore when reporting
   * an error
   */
  ignoreStatuses = [400, 422, 401];
  /**
   * An array of error codes to ignore when reporting
   * an error
   */
  ignoreCodes = [];
  /**
   * Expands status pages
   */
  #expandStatusPages() {
    if (!this.#expandedStatusPages) {
      this.#expandedStatusPages = Object.keys(this.statusPages).reduce(
        (result, range) => {
          const renderer = this.statusPages[range];
          result = Object.assign(result, parseRange(range, renderer));
          return result;
        },
        {}
      );
    }
    return this.#expandedStatusPages;
  }
  /**
   * Forcefully tweaking the type of the error object to
   * have known properties.
   */
  #toHttpError(error) {
    const httpError = is.object(error) ? error : new Error(String(error));
    if (!httpError.message) {
      httpError.message = "Internal server error";
    }
    if (!httpError.status) {
      httpError.status = 500;
    }
    return httpError;
  }
  /**
   * Error reporting context
   */
  context(ctx) {
    const requestId = ctx.request.id();
    return requestId ? {
      "x-request-id": requestId
    } : {};
  }
  /**
   * Returns the log level for an error based upon the error
   * status code.
   */
  getErrorLogLevel(error) {
    if (error.status >= 500) {
      return "error";
    }
    if (error.status >= 400) {
      return "warn";
    }
    return "info";
  }
  /**
   * A boolean to control if errors should be rendered with
   * all the available debugging info.
   */
  isDebuggingEnabled(_) {
    return this.debug;
  }
  /**
   * Returns a boolean by checking if an error should be reported.
   */
  shouldReport(error) {
    if (this.reportErrors === false) {
      return false;
    }
    if (this.ignoreStatuses.includes(error.status)) {
      return false;
    }
    if (error.code && this.ignoreCodes.includes(error.code)) {
      return false;
    }
    if (this.ignoreExceptions.find((exception) => error instanceof exception)) {
      return false;
    }
    return true;
  }
  /**
   * Renders an error to JSON response
   */
  async renderErrorAsJSON(error, ctx) {
    if (this.isDebuggingEnabled(ctx)) {
      const { default: Youch } = await import("youch");
      const json = await new Youch(error, ctx.request.request).toJSON();
      ctx.response.status(error.status).send(json.error);
      return;
    }
    ctx.response.status(error.status).send({ message: error.message });
  }
  /**
   * Renders an error to JSON API response
   */
  async renderErrorAsJSONAPI(error, ctx) {
    if (this.isDebuggingEnabled(ctx)) {
      const { default: Youch } = await import("youch");
      const json = await new Youch(error, ctx.request.request).toJSON();
      ctx.response.status(error.status).send(json.error);
      return;
    }
    ctx.response.status(error.status).send({
      errors: [
        {
          title: error.message,
          code: error.code,
          status: error.status
        }
      ]
    });
  }
  /**
   * Renders an error to HTML response
   */
  async renderErrorAsHTML(error, ctx) {
    if (this.isDebuggingEnabled(ctx)) {
      const { default: Youch } = await import("youch");
      const html = await new Youch(error, ctx.request.request).toHTML({
        cspNonce: "nonce" in ctx.response ? ctx.response.nonce : void 0
      });
      ctx.response.status(error.status).send(html);
      return;
    }
    ctx.response.status(error.status).send(`<p> ${error.message} </p>`);
  }
  /**
   * Renders the validation error message to a JSON
   * response
   */
  async renderValidationErrorAsJSON(error, ctx) {
    ctx.response.status(error.status).send({
      errors: error.messages
    });
  }
  /**
   * Renders the validation error message as per JSON API
   * spec
   */
  async renderValidationErrorAsJSONAPI(error, ctx) {
    ctx.response.status(error.status).send({
      errors: error.messages.map((message) => {
        return {
          title: message.message,
          code: message.rule,
          source: {
            pointer: message.field
          },
          meta: message.meta
        };
      })
    });
  }
  /**
   * Renders the validation error as an HTML string
   */
  async renderValidationErrorAsHTML(error, ctx) {
    ctx.response.status(error.status).type("html").send(
      error.messages.map((message) => {
        return `${message.field} - ${message.message}`;
      }).join("<br />")
    );
  }
  /**
   * Renders the error to response
   */
  renderError(error, ctx) {
    switch (ctx.request.accepts(["html", "application/vnd.api+json", "json"])) {
      case "application/vnd.api+json":
        return this.renderErrorAsJSONAPI(error, ctx);
      case "json":
        return this.renderErrorAsJSON(error, ctx);
      case "html":
      default:
        return this.renderErrorAsHTML(error, ctx);
    }
  }
  /**
   * Renders the validation error to response
   */
  renderValidationError(error, ctx) {
    switch (ctx.request.accepts(["html", "application/vnd.api+json", "json"])) {
      case "application/vnd.api+json":
        return this.renderValidationErrorAsJSONAPI(error, ctx);
      case "json":
        return this.renderValidationErrorAsJSON(error, ctx);
      case "html":
      default:
        return this.renderValidationErrorAsHTML(error, ctx);
    }
  }
  /**
   * Reports an error during an HTTP request
   */
  async report(error, ctx) {
    const httpError = this.#toHttpError(error);
    if (!this.shouldReport(httpError)) {
      return;
    }
    if (typeof httpError.report === "function") {
      httpError.report(httpError, ctx);
      return;
    }
    const level = this.getErrorLogLevel(httpError);
    ctx.logger.log(
      level,
      {
        ...level === "error" || level === "fatal" ? { err: httpError } : {},
        ...this.context(ctx)
      },
      httpError.message
    );
  }
  /**
   * Handles the error during the HTTP request.
   */
  async handle(error, ctx) {
    const httpError = this.#toHttpError(error);
    if (typeof httpError.handle === "function") {
      return httpError.handle(httpError, ctx);
    }
    if (httpError.code === "E_VALIDATION_ERROR" && "messages" in httpError) {
      return this.renderValidationError(httpError, ctx);
    }
    const statusPages = this.#expandStatusPages();
    if (this.renderStatusPages && statusPages[httpError.status]) {
      const statusPageResponse = await statusPages[httpError.status](httpError, ctx);
      if (statusPageResponse !== void 0 && // Return value is explicitly defined
      !ctx.response.hasLazyBody && // Lazy body is not set
      statusPageResponse !== ctx.response) {
        return ctx.response.safeStatus(httpError.status).send(statusPageResponse);
      }
      return statusPageResponse;
    }
    return this.renderError(httpError, ctx);
  }
};
export {
  BriskRoute,
  CookieClient,
  ExceptionHandler,
  HttpContext,
  Redirect,
  Request,
  Response,
  ResponseStatus,
  Route,
  RouteGroup,
  RouteResource,
  Router,
  Server,
  defineConfig,
  exceptions_exports as errors
};
//# sourceMappingURL=index.js.map