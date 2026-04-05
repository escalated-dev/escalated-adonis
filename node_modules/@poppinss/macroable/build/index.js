// index.ts
var Macroable = class {
  /**
   * Set of instance properties that will be added to each instance during construction.
   * Each entry contains a key and value pair representing the property name and its value.
   */
  static instanceMacros = /* @__PURE__ */ new Set();
  /**
   * Adds a macro (property or method) to the class prototype.
   * Macros are standard properties that get added to the class prototype,
   * making them available on all instances of the class.
   *
   * @param name - The name of the property or method to add
   * @param value - The value to assign to the property or method
   *
   * @example
   * ```ts
   * // Add a property macro
   * MyClass.macro('version', '1.0.0')
   *
   * // Add a method macro
   * MyClass.macro('greet', function() {
   *   return 'Hello!'
   * })
   *
   * const instance = new MyClass()
   * instance.version // "1.0.0"
   * instance.greet() // "Hello!"
   * ```
   */
  static macro(name, value) {
    this.prototype[name] = value;
  }
  /**
   * Adds an instance property that will be assigned to each instance during construction.
   * Unlike macros which are added to the prototype, instance properties are unique to each instance.
   *
   * @param name - The name of the property to add to instances
   * @param value - The value to assign to the property on each instance
   *
   * @example
   * ```ts
   * // Add an instance method
   * MyClass.instanceProperty('save', function() {
   *   console.log('Saving...', this.id)
   * })
   *
   * const { save } = new MyClass()
   * save()
   * ```
   */
  static instanceProperty(name, value) {
    const self = this;
    if (!self.hasOwnProperty("instanceMacros")) {
      const inheritedProperties = self.instanceMacros;
      Object.defineProperty(self, "instanceMacros", {
        value: new Set(inheritedProperties),
        configurable: true,
        enumerable: true,
        writable: true
      });
    }
    self.instanceMacros.add({ key: name, value });
  }
  /**
   * Adds a getter property to the class prototype using Object.defineProperty.
   * Getters are computed properties that are evaluated each time they are accessed,
   * unless the singleton flag is enabled.
   *
   * @param name - The name of the getter property
   * @param accumulator - Function that computes and returns the property value
   * @param singleton - If true, the getter value is cached after first access
   *
   * @example
   * ```ts
   * // Add a regular getter
   * MyClass.getter('timestamp', function() {
   *   return Date.now()
   * })
   *
   * // Add a singleton getter (cached after first access)
   * MyClass.getter('config', function() {
   *   return loadConfig()
   * }, true)
   *
   * const instance = new MyClass()
   * instance.timestamp // Computed each time
   * instance.config // Computed once, then cached
   * ```
   */
  static getter(name, accumulator, singleton = false) {
    Object.defineProperty(this.prototype, name, {
      get() {
        const value = accumulator.call(this);
        if (singleton) {
          Object.defineProperty(this, name, {
            configurable: false,
            enumerable: false,
            value,
            writable: false
          });
        }
        return value;
      },
      configurable: true,
      enumerable: false
    });
  }
  /**
   * Constructor that applies all registered instance properties to the new instance.
   * This method iterates through the instanceMacros set and assigns each property
   * to the instance, binding functions to the instance context.
   */
  constructor() {
    const self = this;
    const Constructor = this.constructor;
    Constructor.instanceMacros.forEach(({ key, value }) => {
      self[key] = typeof value === "function" ? value.bind(this) : value;
    });
  }
};
export {
  Macroable as default
};
