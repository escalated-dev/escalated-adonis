// src/values_store.ts
import lodash from "@poppinss/utils/lodash";
import { RuntimeException } from "@poppinss/utils";
var ReadOnlyValuesStore = class {
  /**
   * Underlying store values
   */
  values;
  /**
   * Find if store is empty or not
   */
  get isEmpty() {
    return !this.values || Object.keys(this.values).length === 0;
  }
  constructor(values) {
    this.values = values || {};
  }
  /**
   * Get value for a given key
   */
  get(key, defaultValue) {
    const value = lodash.get(this.values, key);
    if (defaultValue !== void 0 && (value === null || value === void 0)) {
      return defaultValue;
    }
    return value;
  }
  /**
   * A boolean to know if value exists. Extra guards to check
   * arrays for it's length as well.
   */
  has(key, checkForArraysLength = true) {
    const value = this.get(key);
    if (!Array.isArray(value)) {
      return !!value;
    }
    return checkForArraysLength ? value.length > 0 : !!value;
  }
  /**
   * Get all values
   */
  all() {
    return this.values;
  }
  /**
   * Returns object representation of values
   */
  toObject() {
    return this.all();
  }
  /**
   * Returns the store values
   */
  toJSON() {
    return this.all();
  }
  /**
   * Returns string representation of the store
   */
  toString() {
    return JSON.stringify(this.all());
  }
};
var ValuesStore = class extends ReadOnlyValuesStore {
  /**
   * A boolean to know if store has been
   * modified
   */
  #modified = false;
  constructor(values) {
    super(values);
  }
  /**
   * Find if the store has been modified.
   */
  get hasBeenModified() {
    return this.#modified;
  }
  /**
   * Set key/value pair
   */
  set(key, value) {
    this.#modified = true;
    lodash.set(this.values, key, value);
  }
  /**
   * Remove key
   */
  unset(key) {
    this.#modified = true;
    lodash.unset(this.values, key);
  }
  /**
   * Pull value from the store. It is same as calling
   * store.get and then store.unset
   */
  pull(key, defaultValue) {
    return ((value) => {
      this.unset(key);
      return value;
    })(this.get(key, defaultValue));
  }
  /**
   * Increment number. The method raises an error when
   * nderlying value is not a number
   */
  increment(key, steps = 1) {
    const value = this.get(key, 0);
    if (typeof value !== "number") {
      throw new RuntimeException(`Cannot increment "${key}". Existing value is not a number`);
    }
    this.set(key, value + steps);
  }
  /**
   * Increment number. The method raises an error when
   * nderlying value is not a number
   */
  decrement(key, steps = 1) {
    const value = this.get(key, 0);
    if (typeof value !== "number") {
      throw new RuntimeException(`Cannot decrement "${key}". Existing value is not a number`);
    }
    this.set(key, value - steps);
  }
  /**
   * Overwrite existing store data with new values.
   */
  update(values) {
    this.#modified = true;
    this.values = values;
  }
  /**
   * Update to merge values
   */
  merge(values) {
    this.#modified = true;
    lodash.merge(this.values, values);
  }
  /**
   * Reset store by clearing it's values.
   */
  clear() {
    this.update({});
  }
};

export {
  ReadOnlyValuesStore,
  ValuesStore
};
//# sourceMappingURL=chunk-TE5JP3SX.js.map