import {
  Logger
} from "../chunk-OKMTVXME.js";

// factories/logger.ts
import { Writable } from "stream";
function getFakeStream(fn) {
  const stream = new Writable();
  stream.write = fn;
  return stream;
}
var LoggerFactory = class {
  #options = {};
  #logsCollection;
  /**
   * Define an array that will be used to writing
   * logs
   */
  pushLogsTo(collection) {
    this.#logsCollection = collection;
    return this;
  }
  /**
   * Merge encryption factory options
   */
  merge(options) {
    Object.assign(this.#options, options);
    return this;
  }
  /**
   * Create instance of the logger class
   */
  create() {
    if (this.#logsCollection) {
      this.#options.desination = getFakeStream((message) => {
        this.#logsCollection.push(message.trim());
        return true;
      });
    }
    return new Logger(this.#options);
  }
};
export {
  LoggerFactory
};
