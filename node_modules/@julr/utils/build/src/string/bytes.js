// src/string/bytes.ts
import bytesPkg from "bytes";
var bytes = {
  format(bytes2, options) {
    const result = bytesPkg.format(bytes2, options);
    if (result === null) {
      throw new Error(`Received invalid bytes value: ${bytes2}`);
    }
    return result;
  },
  parse(value) {
    const result = bytesPkg.parse(value);
    if (result === null) {
      throw new Error(`Received invalid bytes value: ${value}`);
    }
    return result;
  }
};
export {
  bytes
};
