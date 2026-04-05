import {
  Session
} from "./chunk-XP3CBOXR.js";

// src/session_middleware.ts
import { ExceptionHandler } from "@adonisjs/core/http";
var originalErrorHandler = ExceptionHandler.prototype.renderValidationErrorAsHTML;
ExceptionHandler.macro("renderValidationErrorAsHTML", async function(error, ctx) {
  if (ctx.session) {
    ctx.session.flashValidationErrors(error);
    ctx.response.redirect("back", true);
  } else {
    return originalErrorHandler(error, ctx);
  }
});
var SessionMiddleware = class {
  #config;
  #emitter;
  constructor(config, emitter) {
    this.#config = config;
    this.#emitter = emitter;
  }
  async handle(ctx, next) {
    if (!this.#config.enabled) {
      return next();
    }
    ctx.session = new Session(
      this.#config,
      this.#config.stores[this.#config.store],
      // reference to store factory
      this.#emitter,
      ctx
    );
    await ctx.session.initiate(false);
    const response = await next();
    await ctx.session.commit();
    return response;
  }
};

export {
  SessionMiddleware
};
//# sourceMappingURL=chunk-6BSSM3HO.js.map