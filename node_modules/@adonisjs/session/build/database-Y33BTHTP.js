import {
  debug_default
} from "./chunk-5ECC6OWF.js";
import "./chunk-PZ5AY32C.js";

// src/stores/database.ts
import string from "@poppinss/utils/string";
import { MessageBuilder } from "@adonisjs/core/helpers";
var DatabaseStore = class {
  #client;
  #tableName;
  #ttlSeconds;
  #gcProbability;
  constructor(client, age, options) {
    this.#client = client;
    this.#tableName = options?.tableName ?? "sessions";
    this.#ttlSeconds = string.seconds.parse(age);
    this.#gcProbability = options?.gcProbability ?? 2;
    debug_default("initiating database store");
  }
  /**
   * Run garbage collection to delete expired sessions.
   * This is called based on gcProbability after writing session data.
   */
  async #collectGarbage() {
    if (this.#gcProbability <= 0) {
      return;
    }
    const random = Math.random() * 100;
    if (random < this.#gcProbability) {
      debug_default("database store: running garbage collection");
      const expiredBefore = new Date(Date.now());
      await this.#client.from(this.#tableName).where("expires_at", "<=", expiredBefore).delete();
    }
  }
  /**
   * Parses and verifies session data using MessageBuilder
   */
  #parseSessionData(contents, sessionId) {
    try {
      return new MessageBuilder().verify(contents, sessionId);
    } catch {
      return null;
    }
  }
  /**
   * Returns session data
   */
  async read(sessionId) {
    debug_default("database store: reading session data %s", sessionId);
    const row = await this.#client.from(this.#tableName).where("id", sessionId).first();
    if (!row) {
      return null;
    }
    const expiresAt = new Date(row.expires_at).getTime();
    if (Date.now() > expiresAt) {
      await this.destroy(sessionId);
      return null;
    }
    return this.#parseSessionData(row.data, sessionId);
  }
  /**
   * Write session values to the database
   */
  async write(sessionId, values) {
    debug_default("database store: writing session data %s, %O", sessionId, values);
    const message = new MessageBuilder().build(values, void 0, sessionId);
    const expiresAt = new Date(Date.now() + this.#ttlSeconds * 1e3);
    await this.#client.insertQuery().table(this.#tableName).insert({ id: sessionId, data: message, expires_at: expiresAt }).knexQuery.onConflict("id").merge(["data", "expires_at"]);
    await this.#collectGarbage();
  }
  /**
   * Cleanup session by removing it
   */
  async destroy(sessionId) {
    debug_default("database store: destroying session data %s", sessionId);
    await this.#client.from(this.#tableName).where("id", sessionId).delete();
  }
  /**
   * Updates the session expiry
   */
  async touch(sessionId) {
    debug_default("database store: touching session data %s", sessionId);
    const expiresAt = new Date(Date.now() + this.#ttlSeconds * 1e3);
    await this.#client.from(this.#tableName).where("id", sessionId).update({ expires_at: expiresAt });
  }
  /**
   * Tag a session with a user ID.
   * Uses UPSERT to handle both existing and new sessions.
   */
  async tag(sessionId, userId) {
    debug_default("database store: tagging session %s with user %s", sessionId, userId);
    const data = new MessageBuilder().build({}, void 0, sessionId);
    const expiresAt = new Date(Date.now() + this.#ttlSeconds * 1e3);
    await this.#client.insertQuery().table(this.#tableName).insert({ id: sessionId, user_id: userId, data, expires_at: expiresAt }).knexQuery.onConflict("id").merge(["user_id"]);
  }
  /**
   * Converts a database row to a TaggedSession object
   */
  #rowToTaggedSession(row) {
    const data = this.#parseSessionData(row.data, row.id);
    if (!data) return null;
    return { id: row.id, data };
  }
  /**
   * Get all sessions for a given user ID (tag)
   */
  async tagged(userId) {
    debug_default("database store: getting sessions tagged with user %s", userId);
    const rows = await this.#client.from(this.#tableName).select("id", "data").where("user_id", userId).where("expires_at", ">", /* @__PURE__ */ new Date());
    return rows.map((row) => this.#rowToTaggedSession(row)).filter((session) => session !== null);
  }
};
export {
  DatabaseStore
};
//# sourceMappingURL=database-Y33BTHTP.js.map