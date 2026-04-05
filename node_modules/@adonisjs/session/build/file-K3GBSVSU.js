import {
  debug_default
} from "./chunk-5ECC6OWF.js";
import "./chunk-PZ5AY32C.js";

// src/stores/file.ts
import { dirname, join } from "path";
import string from "@poppinss/utils/string";
import { MessageBuilder } from "@adonisjs/core/helpers";
import { access, mkdir, readFile, rm, writeFile, utimes, stat } from "fs/promises";
var FileStore = class {
  #config;
  #age;
  /**
   * @param {FileStoreConfig} config
   * @param {string|number}   The age must be in seconds or a time expression
   */
  constructor(config, age) {
    this.#config = config;
    this.#age = age;
    debug_default("initiating file store %O", this.#config);
  }
  /**
   * Returns an absolute path to the session id file
   */
  #getFilePath(sessionId) {
    return join(this.#config.location, `${sessionId}.txt`);
  }
  /**
   * Check if a file exists at a given path or not
   */
  async #pathExists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Returns stats for a file and ignoring missing
   * files.
   */
  async #stats(path) {
    try {
      const stats = await stat(path);
      return stats;
    } catch {
      return null;
    }
  }
  /**
   * Output file with contents to the given path
   */
  async #outputFile(path, contents) {
    const pathDirname = dirname(path);
    const dirExists = await this.#pathExists(pathDirname);
    if (!dirExists) {
      await mkdir(pathDirname, { recursive: true });
    }
    await writeFile(path, contents, "utf-8");
  }
  /**
   * Reads the session data from the disk.
   */
  async read(sessionId) {
    const filePath = this.#getFilePath(sessionId);
    debug_default("file store: reading session data %", sessionId);
    const stats = await this.#stats(filePath);
    if (!stats) {
      return null;
    }
    const sessionWillExpireAt = stats.mtimeMs + string.seconds.parse(this.#age) * 1e3;
    if (Date.now() > sessionWillExpireAt) {
      debug_default("file store: expired session data %s", sessionId);
      return null;
    }
    let contents = await readFile(filePath, "utf-8");
    contents = contents.trim();
    if (!contents) {
      return null;
    }
    try {
      return new MessageBuilder().verify(contents, sessionId);
    } catch {
      return null;
    }
  }
  /**
   * Writes the session data to the disk as a string
   */
  async write(sessionId, values) {
    debug_default("file store: writing session data %s: %O", sessionId, values);
    const filePath = this.#getFilePath(sessionId);
    const message = new MessageBuilder().build(values, void 0, sessionId);
    await this.#outputFile(filePath, message);
  }
  /**
   * Removes the session file from the disk
   */
  async destroy(sessionId) {
    debug_default("file store: destroying session data %s", sessionId);
    await rm(this.#getFilePath(sessionId), { force: true });
  }
  /**
   * Updates the session expiry by rewriting it to the
   * persistence store
   */
  async touch(sessionId) {
    debug_default("file store: touching session data %s", sessionId);
    await utimes(this.#getFilePath(sessionId), /* @__PURE__ */ new Date(), /* @__PURE__ */ new Date());
  }
};
export {
  FileStore
};
//# sourceMappingURL=file-K3GBSVSU.js.map