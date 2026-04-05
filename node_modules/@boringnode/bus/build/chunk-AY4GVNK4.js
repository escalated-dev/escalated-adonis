// src/encoders/json_encoder.ts
var JsonEncoder = class {
  encode(message) {
    return JSON.stringify(message);
  }
  decode(data) {
    return JSON.parse(data.toString());
  }
};

export {
  JsonEncoder
};
/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */
//# sourceMappingURL=chunk-AY4GVNK4.js.map