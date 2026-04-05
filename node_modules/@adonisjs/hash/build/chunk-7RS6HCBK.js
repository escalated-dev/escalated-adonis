// src/helpers.ts
import { promisify } from "node:util";
import { randomBytes, scrypt } from "node:crypto";
var MAX_UINT32 = 2 ** 32 - 1;
var MAX_UINT24 = 2 ** 24 - 1;
var RangeValidator = class {
  static validate(label, value, range) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new TypeError(`The "${label}" option must be an integer`);
    }
    const [min, max] = range;
    if (value < min || value > max) {
      throw new TypeError(
        `The "${label}" option must be in the range (${min} <= ${label} <= ${max})`
      );
    }
  }
};
var EnumValidator = class {
  static validate(label, value, allowedValues) {
    if (!allowedValues.includes(value)) {
      throw new TypeError(`The "${label}" option must be one of: ${allowedValues}`);
    }
  }
};
var randomBytesAsync = promisify(randomBytes);
var scryptAsync = promisify(scrypt);

export {
  MAX_UINT32,
  MAX_UINT24,
  RangeValidator,
  EnumValidator,
  randomBytesAsync,
  scryptAsync
};
