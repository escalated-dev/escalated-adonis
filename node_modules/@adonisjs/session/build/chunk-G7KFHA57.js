import {
  E_SESSION_TAGGING_NOT_SUPPORTED
} from "./chunk-XP3CBOXR.js";
import {
  debug_default
} from "./chunk-5ECC6OWF.js";

// src/session_collection.ts
var SessionCollection = class {
  #store;
  constructor(config) {
    const storeFactory = config.stores[config.store];
    this.#store = storeFactory(null, config);
  }
  /**
   * Check if the current store supports tagging
   */
  supportsTagging() {
    return "tag" in this.#store && "tagged" in this.#store;
  }
  /**
   * Returns the session data for the given session ID,
   * or null if the session does not exist
   */
  async get(sessionId) {
    debug_default("session collection: getting session data %s", sessionId);
    return this.#store.read(sessionId);
  }
  /**
   * Destroys a session by its ID
   */
  async destroy(sessionId) {
    debug_default("session collection: destroying session %s", sessionId);
    return this.#store.destroy(sessionId);
  }
  /**
   * Tag a session with a user ID.
   * Only supported by Memory, Redis and Database stores.
   */
  async tag(sessionId, userId) {
    debug_default("session collection: tagging session %s with user %s", sessionId, userId);
    if (!this.supportsTagging()) throw new E_SESSION_TAGGING_NOT_SUPPORTED();
    return this.#store.tag(sessionId, userId);
  }
  /**
   * Get all sessions for a given user ID (tag).
   * Only supported by Memory, Redis and Database stores.
   */
  async tagged(userId) {
    debug_default("session collection: getting sessions tagged with user %s", userId);
    if (!this.supportsTagging()) throw new E_SESSION_TAGGING_NOT_SUPPORTED();
    return this.#store.tagged(userId);
  }
};

export {
  SessionCollection
};
//# sourceMappingURL=chunk-G7KFHA57.js.map