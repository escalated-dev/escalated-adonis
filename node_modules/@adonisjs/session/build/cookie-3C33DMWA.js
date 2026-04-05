import {
  debug_default
} from "./chunk-5ECC6OWF.js";
import "./chunk-PZ5AY32C.js";

// src/stores/cookie.ts
var CookieStore = class {
  #ctx;
  #config;
  constructor(config, ctx) {
    this.#config = config;
    this.#ctx = ctx;
    debug_default("initiating cookie store %O", this.#config);
  }
  /**
   * Read session value from the cookie
   */
  read(sessionId) {
    debug_default("cookie store: reading session data %s", sessionId);
    const cookieValue = this.#ctx.request.encryptedCookie(sessionId);
    if (typeof cookieValue !== "object") {
      return null;
    }
    return cookieValue;
  }
  /**
   * Write session values to the cookie
   */
  write(sessionId, values) {
    debug_default("cookie store: writing session data %s: %O", sessionId, values);
    this.#ctx.response.encryptedCookie(sessionId, values, this.#config);
  }
  /**
   * Removes the session cookie
   */
  destroy(sessionId) {
    debug_default("cookie store: destroying session data %s", sessionId);
    if (this.#ctx.request.cookiesList()[sessionId]) {
      this.#ctx.response.clearCookie(sessionId);
    }
  }
  /**
   * Updates the cookie with existing cookie values
   */
  touch(sessionId) {
    const value = this.read(sessionId);
    debug_default("cookie store: touching session data %s", sessionId);
    if (!value) {
      return;
    }
    this.write(sessionId, value);
  }
};
export {
  CookieStore
};
//# sourceMappingURL=cookie-3C33DMWA.js.map