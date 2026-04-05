import "../chunk-UXA4FHST.js";

// services/auth.ts
import app from "@adonisjs/core/services/app";
var auth;
await app.booted(async () => {
  auth = await app.container.make("auth.manager");
});
export {
  auth as default
};
