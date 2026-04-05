import "../../chunk-UXA4FHST.js";

// src/middleware/initialize_auth_middleware.ts
var InitializeAuthMiddleware = class {
  async handle(ctx, next) {
    const auth = await ctx.containerResolver.make("auth.manager");
    ctx.auth = auth.createAuthenticator(ctx);
    if ("view" in ctx) {
      ctx.view.share({ auth: ctx.auth });
    }
    return next();
  }
};
export {
  InitializeAuthMiddleware as default
};
