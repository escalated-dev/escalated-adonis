import {
  Application
} from "../chunk-4QIG4EF6.js";
import "../chunk-OVQD25FW.js";

// factories/app.ts
var AppFactory = class {
  #parameters = {};
  /**
   * Merge parameters accepted by the AppFactory
   */
  merge(params) {
    Object.assign(this.#parameters, params);
    return this;
  }
  /**
   * Create application class instance
   */
  create(appRoot, importer) {
    return new Application(
      appRoot,
      Object.assign({ importer }, { environment: "web" }, this.#parameters)
    );
  }
};
export {
  AppFactory
};
