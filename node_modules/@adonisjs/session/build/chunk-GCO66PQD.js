import {
  ValuesStore
} from "./chunk-TE5JP3SX.js";
import {
  debug_default
} from "./chunk-5ECC6OWF.js";

// src/client.ts
import { cuid } from "@adonisjs/core/helpers";
var SessionClient = class {
  /**
   * Data store
   */
  #valuesStore = new ValuesStore({});
  /**
   * Flash messages store
   */
  #flashMessagesStore = new ValuesStore({});
  /**
   * The session store to use for reading and writing session data
   */
  #store;
  /**
   * Session key for setting flash messages
   */
  flashKey = "__flash__";
  /**
   * Session to use when no explicit session id is
   * defined
   */
  sessionId = cuid();
  constructor(store) {
    this.#store = store;
  }
  /**
   * Merge session data
   */
  merge(values) {
    this.#valuesStore.merge(values);
    return this;
  }
  /**
   * Merge flash messages
   */
  flash(values) {
    this.#flashMessagesStore.merge(values);
    return this;
  }
  /**
   * Commits data to the session store.
   */
  async commit() {
    if (!this.#flashMessagesStore.isEmpty) {
      this.#valuesStore.set(this.flashKey, this.#flashMessagesStore.toJSON());
    }
    debug_default("committing session data during api request");
    if (!this.#valuesStore.isEmpty) {
      this.#store.write(this.sessionId, this.#valuesStore.toJSON());
    }
  }
  /**
   * Destroys the session data with the store
   */
  async destroy(sessionId) {
    debug_default("destroying session data during api request");
    this.#store.destroy(sessionId || this.sessionId);
  }
  /**
   * Loads session data from the session store
   */
  async load(sessionId) {
    const contents = await this.#store.read(sessionId || this.sessionId);
    const store = new ValuesStore(contents);
    const flashMessages = store.pull(this.flashKey, {});
    return {
      values: store.all(),
      flashMessages
    };
  }
};

export {
  SessionClient
};
//# sourceMappingURL=chunk-GCO66PQD.js.map