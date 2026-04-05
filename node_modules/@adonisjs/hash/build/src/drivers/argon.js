import {
  EnumValidator,
  MAX_UINT24,
  MAX_UINT32,
  RangeValidator,
  randomBytesAsync
} from "../../chunk-7RS6HCBK.js";
import {
  PhcFormatter
} from "../../chunk-JSA56AE7.js";
import "../../chunk-JSBRDJBE.js";

// src/drivers/argon.ts
import { argon2i, argon2d, argon2id } from "argon2";
import { safeEqual } from "@poppinss/utils";
var Argon = class {
  /**
   * Lazily loaded argon2 binding. Since it is a peer dependency
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
  /**
   * Supported variants
   */
  #variants = {
    i: argon2i,
    d: argon2d,
    id: argon2id
  };
  /**
   * A list of supported argon ids
   */
  #ids = ["argon2d", "argon2i", "argon2id"];
  constructor(config) {
    this.#config = {
      version: 19,
      variant: "id",
      iterations: 3,
      memory: 65536,
      parallelism: 4,
      saltSize: 16,
      hashLength: 32,
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
    this.#binding = await import("argon2");
    return this.#binding;
  }
  /**
   * Validate configuration options
   */
  #validateConfig() {
    RangeValidator.validate("iterations", this.#config.iterations, [2, MAX_UINT32]);
    RangeValidator.validate("parallelism", this.#config.parallelism, [1, MAX_UINT24]);
    RangeValidator.validate("memory", this.#config.memory, [
      8 * this.#config.parallelism,
      MAX_UINT32
    ]);
    EnumValidator.validate("variant", this.#config.variant, Object.keys(this.#variants));
    RangeValidator.validate("saltSize", this.#config.saltSize, [8, 1024]);
    RangeValidator.validate("hashLength", this.#config.hashLength, [4, MAX_UINT32]);
    EnumValidator.validate("version", this.#config.version, [16, 19]);
    Object.freeze(this.#config);
  }
  /**
   * Validate phc hash string
   */
  #validatePhcString(phcString) {
    const phcNode = this.#phcFormatter.deserialize(phcString);
    if (!phcNode.version) {
      phcNode.version = 16;
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
    RangeValidator.validate("salt.byteLength", phcNode.salt.byteLength, [8, 1024]);
    RangeValidator.validate("hash.byteLength", phcNode.hash.byteLength, [4, MAX_UINT32]);
    EnumValidator.validate("id", phcNode.id, this.#ids);
    const variant = phcNode.id.split("argon2")[1];
    EnumValidator.validate("variant", variant, Object.keys(this.#variants));
    EnumValidator.validate("version", phcNode.version, [16, 19]);
    RangeValidator.validate("t", phcNode.params.t, [1, MAX_UINT32]);
    RangeValidator.validate("p", phcNode.params.p, [1, MAX_UINT24]);
    RangeValidator.validate("m", phcNode.params.m, [8 * phcNode.params.p, MAX_UINT32]);
    return {
      id: phcNode.id,
      version: phcNode.version,
      hash: phcNode.hash,
      salt: phcNode.salt,
      params: {
        t: phcNode.params.t,
        m: phcNode.params.m,
        p: phcNode.params.p
      },
      variant
    };
  }
  /**
   * Check if the value is a valid hash. This method just checks
   * for the formatting of the hash.
   *
   * ```ts
   * argon.isValidHash('hello world') // false
   * argon.isValidHash('$argon2id$v=19$t=3,m=4096,p=1$drxJBWzWahR5tMubp+a1Sw$L/Oh2uw6QKW77i/KQ8eGuOt3ui52hEmmKlu1KBVBxiM')
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
   * const hash = await argon.make('password')
   * ```
   */
  async make(value) {
    const driver = await this.#importBinding();
    const salt = await randomBytesAsync(this.#config.saltSize);
    const hash = await driver.hash(value, {
      salt,
      version: this.#config.version,
      type: this.#variants[this.#config.variant],
      timeCost: this.#config.iterations,
      memoryCost: this.#config.memory,
      parallelism: this.#config.parallelism,
      hashLength: this.#config.hashLength,
      secret: this.#config.secret ? Buffer.from(this.#config.secret.release()) : void 0,
      raw: true
    });
    return this.#phcFormatter.serialize(salt, hash, {
      id: `argon2${this.#config.variant}`,
      version: this.#config.version,
      params: {
        m: this.#config.memory,
        t: this.#config.iterations,
        p: this.#config.parallelism
      }
    });
  }
  /**
   * Verify the plain text value against an existing hash
   *
   * ```ts
   * if (await argon.verify(hash, plainText)) {
   *
   * }
   * ```
   */
  async verify(hashedValue, plainValue) {
    const driver = await this.#importBinding();
    try {
      const phcNode = this.#validatePhcString(hashedValue);
      const newHash = await driver.hash(plainValue, {
        salt: phcNode.salt,
        version: phcNode.version,
        type: this.#variants[phcNode.variant],
        timeCost: phcNode.params.t,
        memoryCost: phcNode.params.m,
        parallelism: phcNode.params.p,
        hashLength: phcNode.hash.byteLength,
        secret: this.#config.secret ? Buffer.from(this.#config.secret.release()) : void 0,
        raw: true
      });
      return safeEqual(newHash, phcNode.hash);
    } catch {
      return false;
    }
  }
  /**
   * Find if the hash value needs a rehash or not. The rehash is
   * required when.
   *
   * 1. The argon2 version is changed
   * 2. Number of iterations are changed
   * 3. The memory value is changed
   * 4. The parellelism value is changed
   * 5. The argon variant is changed
   * 6. The provided hash has not been hashed with argon
   *
   * ```ts
   * const isValid = await argon.verify(hash, plainText)
   *
   * // Plain password is valid and hash needs a rehash
   * if (isValid && await argon.needsReHash(hash)) {
   *   const newHash = await argon.make(plainText)
   * }
   * ```
   */
  needsReHash(value) {
    const phcNode = this.#phcFormatter.deserialize(value);
    if (!this.#ids.includes(phcNode.id)) {
      return true;
    }
    if (phcNode.version !== this.#config.version) {
      return true;
    }
    if (phcNode.id !== `argon2${this.#config.variant}`) {
      return true;
    }
    if (!phcNode.params) {
      return true;
    }
    if (phcNode.params.m !== this.#config.memory) {
      return true;
    }
    if (phcNode.params.t !== this.#config.iterations) {
      return true;
    }
    if (phcNode.params.p !== this.#config.parallelism) {
      return true;
    }
    return false;
  }
};
export {
  Argon
};
