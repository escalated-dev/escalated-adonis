import {
  debug_default
} from "./chunk-5ECC6OWF.js";
import "./chunk-PZ5AY32C.js";

// src/stores/redis.ts
import string from "@poppinss/utils/string";
import { MessageBuilder } from "@adonisjs/core/helpers";
var RedisStore = class {
  #connection;
  #ttlSeconds;
  constructor(connection, age) {
    this.#connection = connection;
    this.#ttlSeconds = string.seconds.parse(age);
    debug_default("initiating redis store");
  }
  /**
   * Returns the key for a user's tag set (stores session IDs for a user)
   */
  #getTagKey(userId) {
    return `session_tag:${userId}`;
  }
  /**
   * Verify contents with the session id and return them as an object. The verify
   * method can fail when the contents is not JSON
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
    debug_default("redis store: reading session data %s", sessionId);
    const contents = await this.#connection.get(sessionId);
    if (!contents) {
      return null;
    }
    return this.#parseSessionData(contents, sessionId);
  }
  /**
   * Write session values to redis
   */
  async write(sessionId, values) {
    debug_default("redis store: writing session data %s, %O", sessionId, values);
    const message = new MessageBuilder().build(values, void 0, sessionId);
    await this.#connection.setex(sessionId, this.#ttlSeconds, message);
  }
  /**
   * Cleanup session by removing it
   */
  async destroy(sessionId) {
    debug_default("redis store: destroying session data %s", sessionId);
    await this.#connection.del(sessionId);
  }
  /**
   * Updates the value expiry
   */
  async touch(sessionId) {
    debug_default("redis store: touching session data %s", sessionId);
    await this.#connection.expire(sessionId, this.#ttlSeconds);
  }
  /**
   * Tag a session with a user ID
   */
  async tag(sessionId, userId) {
    debug_default("redis store: tagging session %s with user %s", sessionId, userId);
    await this.#connection.sadd(this.#getTagKey(userId), sessionId);
  }
  /**
   * Processes a single session result from the pipeline
   */
  #processSessionResult(options) {
    if (!options.contents) return { session: null, isInvalid: true };
    const data = this.#parseSessionData(options.contents, options.sessionId);
    if (!data) return { session: null, isInvalid: true };
    return { session: { id: options.sessionId, data }, isInvalid: false };
  }
  /**
   * Fetches session contents for multiple session IDs using a pipeline
   */
  async #fetchSessionContents(sessionIds) {
    const pipeline = this.#connection.pipeline();
    sessionIds.forEach((sessionId) => pipeline.get(sessionId));
    const results = await pipeline.exec();
    return results?.map((result) => result[1]) ?? [];
  }
  /**
   * Removes invalid session IDs from the user's tag set
   */
  async #cleanupInvalidSessions(userId, invalidSessionIds) {
    if (invalidSessionIds.length === 0) return;
    await this.#connection.srem(this.#getTagKey(userId), ...invalidSessionIds);
  }
  /**
   * Get all sessions for a given user ID (tag)
   */
  async tagged(userId) {
    debug_default("redis store: getting sessions tagged with user %s", userId);
    const sessionIds = await this.#connection.smembers(this.#getTagKey(userId));
    if (sessionIds.length === 0) return [];
    const contents = await this.#fetchSessionContents(sessionIds);
    const results = sessionIds.map(
      (sessionId, index) => this.#processSessionResult({ sessionId, contents: contents[index] })
    );
    const validSessions = results.filter((r) => r.session !== null).map((r) => r.session);
    const invalidSessionIds = results.map((result, index) => result.isInvalid ? sessionIds[index] : null).filter((id) => id !== null);
    await this.#cleanupInvalidSessions(userId, invalidSessionIds);
    return validSessions;
  }
};
export {
  RedisStore
};
//# sourceMappingURL=redis-YGX2CNE2.js.map