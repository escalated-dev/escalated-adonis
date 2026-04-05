// src/hash.ts
import { AssertionError } from "node:assert";
var Hash = class {
  #driver;
  constructor(driver) {
    this.#driver = driver;
  }
  /**
   * Check if the value is a valid hash. This method just checks
   * for the formatting of the hash
   */
  isValidHash(value) {
    return this.#driver.isValidHash(value);
  }
  /**
   * Hash plain text value
   */
  make(value) {
    return this.#driver.make(value);
  }
  /**
   * Verify the plain text value against an existing hash
   */
  verify(hashedValue, plainValue) {
    return this.#driver.verify(hashedValue, plainValue);
  }
  /**
   * Find if the hash value needs a rehash or not.
   */
  needsReHash(hashedValue) {
    return this.#driver.needsReHash(hashedValue);
  }
  /**
   * Assert the plain value passes the hash verification
   */
  async assertEquals(hashedValue, plainValue) {
    const isEqual = await this.#driver.verify(hashedValue, plainValue);
    if (!isEqual) {
      throw new AssertionError({
        message: `Expected "${plainValue}" to pass hash verification`,
        expected: true,
        actual: false,
        operator: "strictEqual",
        stackStartFn: this.assertEquals
      });
    }
  }
  /**
   * Assert the plain value fails the hash verification
   */
  async assertNotEquals(hashedValue, plainValue) {
    const isEqual = await this.#driver.verify(hashedValue, plainValue);
    if (isEqual) {
      throw new AssertionError({
        message: `Expected "${plainValue}" to fail hash verification`,
        expected: false,
        actual: true,
        operator: "strictEqual",
        stackStartFn: this.assertNotEquals
      });
    }
  }
};

// src/hash_manager.ts
import { RuntimeException } from "@poppinss/utils";

// src/debug.ts
import { debuglog } from "node:util";
var debug_default = debuglog("adonisjs:hash");

// src/drivers/fake.ts
var Fake = class {
  /**
   * Always returns true
   */
  isValidHash(_) {
    return true;
  }
  /**
   * Returns the value as it is
   */
  async make(value) {
    return value;
  }
  /**
   * Checks the hash and the plain text value using
   * equality check
   */
  async verify(hashedValue, plainValue) {
    return hashedValue === plainValue;
  }
  /**
   * Always returns false
   */
  needsReHash(_) {
    return false;
  }
};

// src/hash_manager.ts
var HashManager = class {
  constructor(config) {
    this.config = config;
    debug_default("creating hash manager. config: %O", this.config);
  }
  /**
   * Fake hasher
   */
  #fakeHasher;
  /**
   * Cache of hashers
   */
  #hashersCache = {};
  /**
   * Use one of the registered hashers to hash values.
   *
   * ```ts
   * manager.use() // returns default hasher
   * manager.use('argon')
   * ```
   */
  use(hasher) {
    let hasherToUse = hasher || this.config.default;
    if (!hasherToUse) {
      throw new RuntimeException(
        "Cannot create hash instance. No default hasher is defined in the config"
      );
    }
    if (this.#fakeHasher) {
      return this.#fakeHasher;
    }
    const cachedHasher = this.#hashersCache[hasherToUse];
    if (cachedHasher) {
      debug_default('using hasher from cache. name: "%s"', hasherToUse);
      return cachedHasher;
    }
    const driverFactory = this.config.list[hasherToUse];
    debug_default('creating hash driver. name: "%s"', hasherToUse);
    const hash = new Hash(driverFactory());
    this.#hashersCache[hasherToUse] = hash;
    return hash;
  }
  /**
   * Fake hash drivers to disable hashing values
   */
  fake() {
    debug_default("enabling fakes");
    if (!this.#fakeHasher) {
      this.#fakeHasher = new Hash(new Fake());
    }
  }
  /**
   * Restore fake
   */
  restore() {
    debug_default("restoring fakes");
    this.#fakeHasher = void 0;
  }
  /**
   * Check if the value is a valid hash. This method just checks
   * for the formatting of the hash
   */
  isValidHash(value) {
    return this.use().isValidHash(value);
  }
  /**
   * Hash plain text value
   */
  make(value) {
    return this.use().make(value);
  }
  /**
   * Verify the plain text value against an existing hash
   */
  verify(hashedValue, plainValue) {
    return this.use().verify(hashedValue, plainValue);
  }
  /**
   * Find if the hash value needs a rehash or not.
   */
  needsReHash(hashedValue) {
    return this.use().needsReHash(hashedValue);
  }
  /**
   * Assert the plain value passes the hash verification
   */
  async assertEquals(hashedValue, plainValue) {
    return this.use().assertEquals(hashedValue, plainValue);
  }
  /**
   * Assert the plain value fails the hash verification
   */
  async assertNotEquals(hashedValue, plainValue) {
    return this.use().assertNotEquals(hashedValue, plainValue);
  }
};

export {
  Hash,
  HashManager
};
