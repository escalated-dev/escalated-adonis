var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/errors.ts
var errors_exports = {};
__export(errors_exports, {
  E_INSECURE_APP_KEY: () => E_INSECURE_APP_KEY,
  E_MISSING_APP_KEY: () => E_MISSING_APP_KEY
});
import { createError } from "@poppinss/utils";
var E_INSECURE_APP_KEY = createError(
  'The value of "app.appKey" should be atleast 16 characters long',
  "E_INSECURE_APP_KEY"
);
var E_MISSING_APP_KEY = createError(
  'Missing "app.appKey". The key is required to encrypt values',
  "E_MISSING_APP_KEY"
);

// src/encryption.ts
import string from "@poppinss/utils/string";
import { base64 as base643, MessageBuilder as MessageBuilder2 } from "@poppinss/utils";
import { createHash as createHash2, createCipheriv, createDecipheriv } from "node:crypto";

// src/hmac.ts
import { createHmac } from "node:crypto";
import { base64, safeEqual } from "@poppinss/utils";
var Hmac = class {
  #key;
  constructor(key) {
    this.#key = key;
  }
  /**
   * Generate the hmac
   */
  generate(value) {
    return base64.urlEncode(createHmac("sha256", this.#key).update(value).digest());
  }
  /**
   * Compare raw value against an existing hmac
   */
  compare(value, existingHmac) {
    return safeEqual(this.generate(value), existingHmac);
  }
};

// src/message_verifier.ts
import { createHash } from "node:crypto";
import { base64 as base642, MessageBuilder, RuntimeException } from "@poppinss/utils";
var MessageVerifier = class {
  /**
   * The key for signing and encrypting values. It is derived
   * from the user provided secret.
   */
  #cryptoKey;
  /**
   * Use `dot` as a separator for joining encrypted value, iv and the
   * hmac hash. The idea is borrowed from JWT's in which each part
   * of the payload is concatenated with a dot.
   */
  #separator = ".";
  constructor(secret) {
    this.#cryptoKey = createHash("sha256").update(secret).digest();
  }
  /**
   * Sign a given piece of value using the app secret. A wide range of
   * data types are supported.
   *
   * - String
   * - Arrays
   * - Objects
   * - Booleans
   * - Numbers
   * - Dates
   *
   * You can optionally define a purpose for which the value was signed and
   * mentioning a different purpose/no purpose during unsign will fail.
   */
  sign(payload, expiresIn, purpose) {
    if (payload === null || payload === void 0) {
      throw new RuntimeException(`Cannot sign "${payload}" value`);
    }
    const encoded = base642.urlEncode(new MessageBuilder().build(payload, expiresIn, purpose));
    return `${encoded}${this.#separator}${new Hmac(this.#cryptoKey).generate(encoded)}`;
  }
  /**
   * Unsign a previously signed value with an optional purpose
   */
  unsign(payload, purpose) {
    if (typeof payload !== "string") {
      return null;
    }
    const [encoded, hash] = payload.split(this.#separator);
    if (!encoded || !hash) {
      return null;
    }
    const decoded = base642.urlDecode(encoded, void 0, false);
    if (!decoded) {
      return null;
    }
    const isValid = new Hmac(this.#cryptoKey).compare(encoded, hash);
    return isValid ? new MessageBuilder().verify(decoded, purpose) : null;
  }
};

// src/encryption.ts
var Encryption = class _Encryption {
  #options;
  /**
   * The key for signing and encrypting values. It is derived
   * from the user provided secret.
   */
  #cryptoKey;
  /**
   * Use `dot` as a separator for joining encrypted value, iv and the
   * hmac hash. The idea is borrowed from JWTs.
   */
  #separator = ".";
  /**
   * Reference to the instance of message verifier for signing
   * and verifying values.
   */
  verifier;
  /**
   * Reference to base64 object for base64 encoding/decoding values
   */
  base64 = base643;
  /**
   * The algorithm in use
   */
  get algorithm() {
    return this.#options.algorithm;
  }
  constructor(options) {
    const secretValue = options.secret && typeof options.secret === "object" && "release" in options.secret ? options.secret.release() : options.secret;
    this.#options = { algorithm: "aes-256-cbc", ...options };
    this.#validateSecret(secretValue);
    this.#cryptoKey = createHash2("sha256").update(secretValue).digest();
    this.verifier = new MessageVerifier(secretValue);
  }
  /**
   * Validates the app secret
   */
  #validateSecret(secret) {
    if (typeof secret !== "string") {
      throw new E_MISSING_APP_KEY();
    }
    if (secret.length < 16) {
      throw new E_INSECURE_APP_KEY();
    }
  }
  /**
   * Encrypt a given piece of value using the app secret. A wide range of
   * data types are supported.
   *
   * - String
   * - Arrays
   * - Objects
   * - Booleans
   * - Numbers
   * - Dates
   *
   * You can optionally define a purpose for which the value was encrypted and
   * mentioning a different purpose/no purpose during decrypt will fail.
   */
  encrypt(payload, expiresIn, purpose) {
    const iv = string.random(16);
    const cipher = createCipheriv(this.algorithm, this.#cryptoKey, iv);
    const encodedValue = new MessageBuilder2().build(payload, expiresIn, purpose);
    const encrypted = Buffer.concat([cipher.update(encodedValue, "utf-8"), cipher.final()]);
    const result = `${this.base64.urlEncode(encrypted)}${this.#separator}${this.base64.urlEncode(
      iv
    )}`;
    return `${result}${this.#separator}${new Hmac(this.#cryptoKey).generate(result)}`;
  }
  /**
   * Decrypt value and verify it against a purpose
   */
  decrypt(value, purpose) {
    if (typeof value !== "string") {
      return null;
    }
    const [encryptedEncoded, ivEncoded, hash] = value.split(this.#separator);
    if (!encryptedEncoded || !ivEncoded || !hash) {
      return null;
    }
    const encrypted = this.base64.urlDecode(encryptedEncoded, "base64");
    if (!encrypted) {
      return null;
    }
    const iv = this.base64.urlDecode(ivEncoded);
    if (!iv) {
      return null;
    }
    const isValidHmac = new Hmac(this.#cryptoKey).compare(
      `${encryptedEncoded}${this.#separator}${ivEncoded}`,
      hash
    );
    if (!isValidHmac) {
      return null;
    }
    try {
      const decipher = createDecipheriv(this.algorithm, this.#cryptoKey, iv);
      const decrypted = decipher.update(encrypted, "base64", "utf8") + decipher.final("utf8");
      return new MessageBuilder2().verify(decrypted, purpose);
    } catch {
      return null;
    }
  }
  /**
   * Create a children instance with different secret key
   */
  child(options) {
    return new _Encryption({ ...this.#options, ...options });
  }
};

export {
  errors_exports,
  Encryption
};
//# sourceMappingURL=chunk-CEXVRLXG.js.map