import {
  ReadOnlyValuesStore,
  ValuesStore
} from "./chunk-TE5JP3SX.js";
import {
  debug_default
} from "./chunk-5ECC6OWF.js";
import {
  __export
} from "./chunk-PZ5AY32C.js";

// src/errors.ts
var errors_exports = {};
__export(errors_exports, {
  E_SESSION_NOT_MUTABLE: () => E_SESSION_NOT_MUTABLE,
  E_SESSION_NOT_READY: () => E_SESSION_NOT_READY,
  E_SESSION_TAGGING_NOT_SUPPORTED: () => E_SESSION_TAGGING_NOT_SUPPORTED
});
import { createError } from "@poppinss/utils";
var E_SESSION_NOT_MUTABLE = createError(
  "Session store is in readonly mode and cannot be mutated",
  "E_SESSION_NOT_MUTABLE",
  500
);
var E_SESSION_NOT_READY = createError(
  "Session store has not been initiated. Make sure you have registered the session middleware",
  "E_SESSION_NOT_READY",
  500
);
var E_SESSION_TAGGING_NOT_SUPPORTED = createError(
  "Session store does not support tagging operations. Only Redis, Database and Memory stores support tagging.",
  "E_SESSION_TAGGING_NOT_SUPPORTED",
  500
);

// src/session.ts
import Macroable from "@poppinss/macroable";
import lodash from "@poppinss/utils/lodash";
import { cuid } from "@adonisjs/core/helpers";
var Session = class extends Macroable {
  constructor(config, storeFactory, emitter, ctx) {
    super();
    this.config = config;
    this.#ctx = ctx;
    this.#emitter = emitter;
    this.#store = storeFactory(ctx, config);
    this.#sessionIdFromCookie = ctx.request.cookie(config.cookieName, void 0);
    this.#sessionId = this.#sessionIdFromCookie || cuid();
  }
  #store;
  #emitter;
  #ctx;
  #readonly = false;
  /**
   * Session values store
   */
  #valuesStore;
  /**
   * Session id refers to the session id that will be committed
   * as a cookie during the response.
   */
  #sessionId;
  /**
   * Session id from cookie refers to the value we read from the
   * cookie during the HTTP request.
   *
   * This only might not exist during the first request. Also during
   * session id re-generation, this value will be different from
   * the session id.
   */
  #sessionIdFromCookie;
  /**
   * Store of flash messages that be written during the
   * HTTP request
   */
  responseFlashMessages = new ValuesStore({});
  /**
   * Store of flash messages for the current HTTP request.
   */
  flashMessages = new ValuesStore({});
  /**
   * The key to use for storing flash messages inside
   * the session store.
   */
  flashKey = "__flash__";
  /**
   * Session id for the current HTTP request
   */
  get sessionId() {
    return this.#sessionId;
  }
  /**
   * A boolean to know if a fresh session is created during
   * the request
   */
  get fresh() {
    return this.#sessionIdFromCookie === void 0;
  }
  /**
   * A boolean to know if session is in readonly
   * state
   */
  get readonly() {
    return this.#readonly;
  }
  /**
   * A boolean to know if session store has been initiated
   */
  get initiated() {
    return !!this.#valuesStore;
  }
  /**
   * A boolean to know if the session id has been re-generated
   * during the current request
   */
  get hasRegeneratedSession() {
    return !!(this.#sessionIdFromCookie && this.#sessionIdFromCookie !== this.#sessionId);
  }
  /**
   * A boolean to know if the session store is empty
   */
  get isEmpty() {
    return this.#valuesStore?.isEmpty ?? true;
  }
  /**
   * A boolean to know if the session store has been
   * modified
   */
  get hasBeenModified() {
    return this.#valuesStore?.hasBeenModified ?? false;
  }
  /**
   * Returns the flash messages store for a given
   * mode
   */
  #getFlashStore(mode) {
    if (!this.#valuesStore) {
      throw new E_SESSION_NOT_READY();
    }
    if (mode === "write" && this.readonly) {
      throw new E_SESSION_NOT_MUTABLE();
    }
    return this.responseFlashMessages;
  }
  /**
   * Returns the store instance for a given mode
   */
  #getValuesStore(mode) {
    if (!this.#valuesStore) {
      throw new E_SESSION_NOT_READY();
    }
    if (mode === "write" && this.readonly) {
      throw new E_SESSION_NOT_MUTABLE();
    }
    return this.#valuesStore;
  }
  /**
   * Initiates the session store. The method results in a noop
   * when called multiple times
   */
  async initiate(readonly) {
    if (this.#valuesStore) {
      return;
    }
    debug_default("initiating session (readonly: %s)", readonly);
    this.#readonly = readonly;
    const contents = await this.#store.read(this.#sessionId);
    this.#valuesStore = new ValuesStore(contents);
    if (this.has(this.flashKey)) {
      debug_default("reading flash data");
      if (this.#readonly) {
        this.flashMessages.update(this.get(this.flashKey, null));
      } else {
        this.flashMessages.update(this.pull(this.flashKey, null));
      }
    }
    if ("view" in this.#ctx) {
      this.#ctx.view.share({
        session: new ReadOnlyValuesStore(this.#valuesStore.all()),
        flashMessages: new ReadOnlyValuesStore(this.flashMessages.all()),
        old: function(key, defaultValue) {
          return this.flashMessages.get(key, defaultValue);
        }
      });
    }
    this.#emitter.emit("session:initiated", { session: this });
  }
  /**
   * Put a key-value pair to the session data store
   */
  put(key, value) {
    this.#getValuesStore("write").set(key, value);
  }
  /**
   * Check if a key exists inside the datastore
   */
  has(key) {
    return this.#getValuesStore("read").has(key);
  }
  /**
   * Get the value of a key from the session datastore.
   * You can specify a default value to use, when key
   * does not exists or has undefined value.
   */
  get(key, defaultValue) {
    return this.#getValuesStore("read").get(key, defaultValue);
  }
  /**
   * Get everything from the session store
   */
  all() {
    return this.#getValuesStore("read").all();
  }
  /**
   * Remove a key from the session datastore
   */
  forget(key) {
    return this.#getValuesStore("write").unset(key);
  }
  /**
   * Read value for a key from the session datastore
   * and remove it simultaneously.
   */
  pull(key, defaultValue) {
    return this.#getValuesStore("write").pull(key, defaultValue);
  }
  /**
   * Increment the value of a key inside the session
   * store.
   *
   * A new key will be defined if does not exists already.
   * The value of a new key will be 1
   */
  increment(key, steps = 1) {
    return this.#getValuesStore("write").increment(key, steps);
  }
  /**
   * Increment the value of a key inside the session
   * store.
   *
   * A new key will be defined if does not exists already.
   * The value of a new key will be -1
   */
  decrement(key, steps = 1) {
    return this.#getValuesStore("write").decrement(key, steps);
  }
  /**
   * Empty the session store
   */
  clear() {
    return this.#getValuesStore("write").clear();
  }
  flash(key, value) {
    if (typeof key === "string") {
      if (value) {
        this.#getFlashStore("write").set(key, value);
      }
    } else {
      this.#getFlashStore("write").merge(key);
    }
  }
  /**
   * Flash errors to the errorsBag. You can read these
   * errors via the "@error" tag.
   *
   * Appends new messages to the existing collection.
   */
  flashErrors(errorsCollection) {
    this.flash({ errorsBag: errorsCollection });
  }
  /**
   * Flash validation error messages. Make sure the error
   * is an instance of VineJS ValidationException.
   *
   * Overrides existing inputErrors
   */
  flashValidationErrors(error) {
    const errorsBag = error.messages.reduce((result, message) => {
      if (result[message.field]) {
        result[message.field].push(message.message);
      } else {
        result[message.field] = [message.message];
      }
      return result;
    }, {});
    this.flashExcept(["_csrf", "_method", "password", "password_confirmation"]);
    let summary = "The form could not be saved. Please check the errors below.";
    if ("i18n" in this.#ctx) {
      summary = this.#ctx.i18n.t(
        `errors.${error.code}`,
        {
          count: error.messages.length
        },
        summary
      );
    }
    this.flashErrors({
      [String(error.code)]: summary
    });
    this.flash("inputErrorsBag", errorsBag);
    this.flash("errors", errorsBag);
  }
  /**
   * Flash form input data to the flash messages store
   */
  flashAll() {
    return this.#getFlashStore("write").set("input", this.#ctx.request.original());
  }
  /**
   * Flash form input data (except some keys) to the flash messages store
   */
  flashExcept(keys) {
    this.#getFlashStore("write").set("input", lodash.omit(this.#ctx.request.original(), keys));
  }
  /**
   * Flash form input data (only some keys) to the flash messages store
   */
  flashOnly(keys) {
    this.#getFlashStore("write").set("input", lodash.pick(this.#ctx.request.original(), keys));
  }
  /**
   * Reflash messages from the last request in the current response
   */
  reflash() {
    this.#getFlashStore("write").set("reflashed", this.flashMessages.all());
  }
  /**
   * Reflash messages (only some keys) from the last
   * request in the current response
   */
  reflashOnly(keys) {
    this.#getFlashStore("write").set("reflashed", lodash.pick(this.flashMessages.all(), keys));
  }
  /**
   * Reflash messages (except some keys) from the last
   * request in the current response
   */
  reflashExcept(keys) {
    this.#getFlashStore("write").set("reflashed", lodash.omit(this.flashMessages.all(), keys));
  }
  /**
   * Re-generate the session id and migrate data to it.
   */
  regenerate() {
    this.#sessionId = cuid();
  }
  /**
   * Tag the current session with a user ID. This allows you to
   * later retrieve all sessions for a given user via SessionCollection.
   *
   * Only Memory, Redis and Database stores support tagging. Other stores
   * will throw an error.
   */
  async tag(userId) {
    if (!("tag" in this.#store)) throw new E_SESSION_TAGGING_NOT_SUPPORTED();
    await this.#store.tag(this.#sessionId, userId);
  }
  /**
   * Commit session changes. No more mutations will be
   * allowed after commit.
   */
  async commit() {
    if (!this.#valuesStore || this.readonly) {
      return;
    }
    if (!this.responseFlashMessages.isEmpty) {
      const { input, reflashed, ...others } = this.responseFlashMessages.all();
      this.put(this.flashKey, { ...reflashed, ...input, ...others });
    }
    debug_default("committing session data");
    this.#ctx.response.cookie(this.config.cookieName, this.#sessionId, this.config.cookie);
    if (this.isEmpty) {
      if (this.#sessionIdFromCookie) {
        await this.#store.destroy(this.#sessionIdFromCookie);
      }
      this.#emitter.emit("session:committed", { session: this });
      return;
    }
    if (!this.hasBeenModified) {
      if (this.#sessionIdFromCookie && this.#sessionIdFromCookie !== this.#sessionId) {
        await this.#store.destroy(this.#sessionIdFromCookie);
        await this.#store.write(this.#sessionId, this.#valuesStore.toJSON());
        this.#emitter.emit("session:migrated", {
          fromSessionId: this.#sessionIdFromCookie,
          toSessionId: this.sessionId,
          session: this
        });
      } else {
        await this.#store.touch(this.#sessionId);
      }
      this.#emitter.emit("session:committed", { session: this });
      return;
    }
    if (this.#sessionIdFromCookie && this.#sessionIdFromCookie !== this.#sessionId) {
      await this.#store.destroy(this.#sessionIdFromCookie);
      await this.#store.write(this.#sessionId, this.#valuesStore.toJSON());
      this.#emitter.emit("session:migrated", {
        fromSessionId: this.#sessionIdFromCookie,
        toSessionId: this.sessionId,
        session: this
      });
    } else {
      await this.#store.write(this.#sessionId, this.#valuesStore.toJSON());
    }
    this.#emitter.emit("session:committed", { session: this });
  }
};

export {
  E_SESSION_TAGGING_NOT_SUPPORTED,
  errors_exports,
  Session
};
//# sourceMappingURL=chunk-XP3CBOXR.js.map