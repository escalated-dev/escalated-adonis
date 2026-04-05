import {
  EnumValidator,
  RangeValidator,
  randomBytesAsync
} from "../../chunk-7RS6HCBK.js";
import {
  PhcFormatter
} from "../../chunk-JSA56AE7.js";
import {
  __commonJS,
  __toESM
} from "../../chunk-JSBRDJBE.js";

// src/legacy/bcrypt_base64.cjs
var require_bcrypt_base64 = __commonJS({
  "src/legacy/bcrypt_base64.cjs"(exports, module) {
    var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
    var BASE64_INDEX = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      0,
      1,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    function encode2(buff) {
      const len = buff.byteLength;
      let off = 0;
      const stra = [];
      while (off < len) {
        let c1 = buff[off++] & 255;
        stra.push(BASE64_CODE[c1 >> 2 & 63]);
        c1 = (c1 & 3) << 4;
        if (off >= len) {
          stra.push(BASE64_CODE[c1 & 63]);
          break;
        }
        let c2 = buff[off++] & 255;
        c1 |= c2 >> 4 & 15;
        stra.push(BASE64_CODE[c1 & 63]);
        c1 = (c2 & 15) << 2;
        if (off >= len) {
          stra.push(BASE64_CODE[c1 & 63]);
          break;
        }
        c2 = buff[off++] & 255;
        c1 |= c2 >> 6 & 3;
        stra.push(BASE64_CODE[c1 & 63]);
        stra.push(BASE64_CODE[c2 & 63]);
      }
      return stra.join("");
    }
    function decode2(str) {
      let off = 0;
      let olen = 0;
      const slen = str.length;
      const stra = [];
      const len = str.length;
      while (off < slen - 1 && olen < len) {
        let code = str.charCodeAt(off++);
        const c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
        code = str.charCodeAt(off++);
        const c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
        if (c1 === -1 || c2 === -1) break;
        let o = c1 << 2 >>> 0;
        o |= (c2 & 48) >> 4;
        stra.push(String.fromCharCode(o));
        if (++olen >= len || off >= slen) break;
        code = str.charCodeAt(off++);
        const c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
        if (c3 === -1) break;
        o = (c2 & 15) << 4 >>> 0;
        o |= (c3 & 60) >> 2;
        stra.push(String.fromCharCode(o));
        if (++olen >= len || off >= slen) break;
        code = str.charCodeAt(off++);
        const c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
        o = (c3 & 3) << 6 >>> 0;
        o |= c4;
        stra.push(String.fromCharCode(o));
        ++olen;
      }
      const buffa = [];
      for (off = 0; off < olen; off++) buffa.push(stra[off].charCodeAt(0));
      return Buffer.from(buffa);
    }
    module.exports = {
      encode: encode2,
      decode: decode2
    };
  }
});

// src/drivers/bcrypt.ts
var bcryptBase64 = __toESM(require_bcrypt_base64(), 1);
import { safeEqual } from "@poppinss/utils";
var Bcrypt = class {
  /**
   * Lazily loaded bcrypt binding. Since it is a peer dependency
   * we cannot import it at top level
   */
  #binding;
  /**
   * Config with defaults merged
   */
  #config;
  /**
   * Formatter to serialize and deserialize phc string
   */
  #phcFormatter = new PhcFormatter();
  constructor(config) {
    this.#config = {
      rounds: 10,
      saltSize: 16,
      version: 98,
      ...config
    };
    this.#validateConfig();
  }
  /**
   * Dynamically importing underlying binding
   */
  async #importBinding() {
    if (this.#binding) {
      return this.#binding;
    }
    this.#binding = await import("bcrypt");
    return this.#binding;
  }
  /**
   * Generates salt for bcrypt
   */
  #generateBcryptSalt(salt, version, rounds) {
    const bcryptVersionCharCode = String.fromCharCode(version);
    const paddedRounds = rounds > 9 ? `${rounds}` : `0${rounds}`;
    return `$2${bcryptVersionCharCode}$${paddedRounds}$${bcryptBase64.encode(salt)}`;
  }
  /**
   * Validate config
   */
  #validateConfig() {
    RangeValidator.validate("rounds", this.#config.rounds, [4, 31]);
    RangeValidator.validate("saltSize", this.#config.saltSize, [8, 1024]);
    EnumValidator.validate("version", this.#config.version, [97, 98]);
    Object.freeze(this.#config);
  }
  /**
   * Validate phc hash string
   */
  #validatePhcString(phcString) {
    const phcNode = this.#phcFormatter.deserialize(phcString);
    if (!phcNode.version) {
      phcNode.version = 97;
    }
    if (phcNode.id !== "bcrypt") {
      throw new TypeError(`Invalid "id" found in the phc string`);
    }
    if (!phcNode.params) {
      throw new TypeError(`No "params" found in the phc string`);
    }
    if (!phcNode.salt) {
      throw new TypeError(`No "salt" found in the phc string`);
    }
    if (!phcNode.hash) {
      throw new TypeError(`No "hash" found in the phc string`);
    }
    if (!phcNode.hash.byteLength) {
      throw new TypeError(`No "hash" found in the phc string`);
    }
    RangeValidator.validate("salt.byteLength", phcNode.salt.byteLength, [8, 1024]);
    EnumValidator.validate("version", phcNode.version, [97, 98]);
    RangeValidator.validate("r", phcNode.params.r, [4, 31]);
    return {
      id: phcNode.id,
      version: phcNode.version,
      hash: phcNode.hash,
      salt: phcNode.salt,
      params: {
        r: phcNode.params.r
      }
    };
  }
  /**
   * Check if the value is a valid hash. This method just checks
   * for the formatting of the hash.
   *
   * ```ts
   * bcrypt.isValidHash('hello world') // false
   * bcrypt.isValidHash('$bcrypt$v=98$r=10$Jtxi46WJ26OQ0khsYLLlnw$knXGfuRFsSjXdj88JydPOnUIglvm1S8')
   * ```
   */
  isValidHash(value) {
    try {
      this.#validatePhcString(value);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Hash a plain text value
   *
   * ```ts
   * const hash = await bcrypt.make('password')
   * ```
   */
  async make(value) {
    const driver = await this.#importBinding();
    const salt = await randomBytesAsync(this.#config.saltSize);
    const bcryptSalt = this.#generateBcryptSalt(salt, this.#config.version, this.#config.rounds);
    const bcryptHash = await driver.hash(value, bcryptSalt);
    const hash = bcryptBase64.decode(bcryptHash.split(bcryptSalt)[1]);
    return this.#phcFormatter.serialize(salt, hash, {
      id: "bcrypt",
      version: this.#config.version,
      params: {
        r: this.#config.rounds
      }
    });
  }
  /**
   * Verify the plain text value against an existing hash
   *
   * ```ts
   * if (await bcrypt.verify(hash, plainText)) {
   *
   * }
   * ```
   */
  async verify(hashedValue, plainValue) {
    const driver = await this.#importBinding();
    try {
      if (hashedValue.startsWith("$2b") || hashedValue.startsWith("$2a")) {
        return await driver.compare(plainValue, hashedValue);
      }
      const phcNode = this.#validatePhcString(hashedValue);
      const bcryptSalt = this.#generateBcryptSalt(phcNode.salt, phcNode.version, phcNode.params.r);
      const bcryptHash = await driver.hash(plainValue, bcryptSalt);
      const hash = bcryptBase64.decode(bcryptHash.split(bcryptSalt)[1]);
      return safeEqual(hash, phcNode.hash);
    } catch {
      return false;
    }
  }
  /**
   * Find if the hash value needs a rehash or not. The rehash is
   * required when.
   *
   * 1. The bcrypt version is changed
   * 2. Number of rounds are changed
   * 3. Bcrypt hash is not using MCF hash format
   * 4. The provided hash has not been hashed with bcrypt
   *
   * ```ts
   * const isValid = await bcrypt.verify(hash, plainText)
   *
   * // Plain password is valid and hash needs a rehash
   * if (isValid && await bcrypt.needsReHash(hash)) {
   *   const newHash = await bcrypt.make(plainText)
   * }
   * ```
   */
  needsReHash(value) {
    if (value.startsWith("$2b") || value.startsWith("$2a")) {
      return true;
    }
    const phcNode = this.#phcFormatter.deserialize(value);
    if (phcNode.id !== "bcrypt") {
      return true;
    }
    if (phcNode.version !== this.#config.version) {
      return true;
    }
    if (!phcNode.params) {
      return true;
    }
    if (phcNode.params.r !== this.#config.rounds) {
      return true;
    }
    return false;
  }
};
export {
  Bcrypt
};
