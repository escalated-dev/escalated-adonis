import {
  Encryption
} from "../chunk-CEXVRLXG.js";

// factories/encryption.ts
var EncryptionFactory = class {
  #options = {
    secret: "averylongrandomsecretkey"
  };
  /**
   * Merge encryption factory options
   */
  merge(options) {
    Object.assign(this.#options, options);
    return this;
  }
  /**
   * Create instance of encryption class
   */
  create() {
    return new Encryption(this.#options);
  }
};
export {
  EncryptionFactory
};
//# sourceMappingURL=main.js.map