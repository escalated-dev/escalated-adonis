/**
 * Abstract class that adds capabilities for extending classes from outside-in,
 * in the form of macros, instance properties, and getters.
 *
 * @example
 * ```ts
 * class User extends Macroable {
 *   name: string
 *   constructor(name: string) {
 *     super()
 *     this.name = name
 *   }
 * }
 *
 * // Add a macro
 * User.macro('greet', function() {
 *   return `Hello, ${this.name}`
 * })
 *
 * // Add a getter
 * User.getter('upperName', function() {
 *   return this.name.toUpperCase()
 * })
 *
 * const user = new User('John')
 * user.greet() // "Hello, John"
 * user.upperName // "JOHN"
 * ```
 */
export default abstract class Macroable {
    /**
     * Set of instance properties that will be added to each instance during construction.
     * Each entry contains a key and value pair representing the property name and its value.
     */
    protected static instanceMacros: Set<{
        key: string | symbol | number;
        value: unknown;
    }>;
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
    static macro<T extends {
        new (...args: any[]): any;
    }, K extends keyof InstanceType<T>>(this: T, name: K, value: InstanceType<T>[K]): void;
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
    static instanceProperty<T extends {
        new (...args: any[]): any;
    }, K extends keyof InstanceType<T>>(this: T, name: K, value: InstanceType<T>[K]): void;
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
    static getter<T extends {
        new (...args: any[]): any;
    }, K extends keyof InstanceType<T>>(this: T, name: K, accumulator: () => InstanceType<T>[K], singleton?: boolean): void;
    /**
     * Constructor that applies all registered instance properties to the new instance.
     * This method iterates through the instanceMacros set and assigns each property
     * to the instance, binding functions to the instance context.
     */
    constructor();
}
