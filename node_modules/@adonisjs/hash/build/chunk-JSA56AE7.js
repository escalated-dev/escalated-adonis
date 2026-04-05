// src/phc_formatter.ts
import phc from "@phc/format";
var PhcFormatter = class {
  /**
   * Serialize salt and hash with predefined options.
   */
  serialize(salt, hash, options) {
    return phc.serialize({
      id: options.id,
      version: options.version,
      params: options.params,
      salt,
      hash
    });
  }
  /**
   * Deserialize a PHC string to an object
   */
  deserialize(phcString) {
    return phc.deserialize(phcString);
  }
};

export {
  PhcFormatter
};
