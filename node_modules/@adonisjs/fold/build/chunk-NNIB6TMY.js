import {
  __name
} from "./chunk-SHUYVCID.js";

// src/container.ts
import { inspect as inspect2 } from "util";
import { InvalidArgumentsException as InvalidArgumentsException2 } from "@poppinss/utils/exception";

// src/debug.ts
import { debuglog } from "util";
var debug_default = debuglog("adonisjs:fold");

// src/helpers.ts
import { RuntimeException } from "@poppinss/utils/exception";

// src/deferred_promise.ts
var Deferred = class {
  static {
    __name(this, "Deferred");
  }
  resolve;
  reject;
  promise = new Promise((resolve, reject) => {
    this.reject = reject;
    this.resolve = resolve;
  });
};

// src/helpers.ts
function isClass(value) {
  return typeof value === "function" && /^class(\s|{)/.test(value.toString());
}
__name(isClass, "isClass");
async function runAsAsync(callback, args) {
  return callback(...args);
}
__name(runAsAsync, "runAsAsync");
function enqueue(callback) {
  let isComputingValue = false;
  let computedValue = {
    completed: false
  };
  let computedError = {
    completed: false
  };
  let queue = [];
  function resolvePromises(value) {
    isComputingValue = false;
    computedValue.completed = true;
    computedValue.value = value;
    queue.forEach((promise) => promise.resolve(value));
    queue = [];
  }
  __name(resolvePromises, "resolvePromises");
  function rejectPromises(error) {
    isComputingValue = false;
    computedError.completed = true;
    computedError.error = error;
    queue.forEach((promise) => promise.reject(error));
    queue = [];
  }
  __name(rejectPromises, "rejectPromises");
  return function(...args) {
    if (computedValue.completed) {
      return computedValue.value;
    }
    if (computedError.completed) {
      throw computedError.error;
    }
    if (isComputingValue) {
      const promise = new Deferred();
      queue.push(promise);
      return promise.promise;
    }
    isComputingValue = true;
    return new Promise((resolve, reject) => {
      runAsAsync(callback, args).then((value) => {
        resolve({
          value,
          cached: false
        });
        resolvePromises({
          value,
          cached: true
        });
      }).catch((error) => {
        reject(error);
        rejectPromises(error);
      });
    });
  };
}
__name(enqueue, "enqueue");
async function resolveDefault(importPath, parentURL) {
  const resolvedPath = await import.meta.resolve(importPath, parentURL);
  const moduleExports = await import(resolvedPath);
  if (!moduleExports.default) {
    throw new RuntimeException(`Missing export default from "${importPath}" module`, {
      cause: {
        source: resolvedPath
      }
    });
  }
  return moduleExports.default;
}
__name(resolveDefault, "resolveDefault");

// src/resolver.ts
import { inspect } from "util";
import { InvalidArgumentsException, RuntimeException as RuntimeException2 } from "@poppinss/utils/exception";

// src/provider.ts
async function containerProvider(binding, property, resolver, runtimeValues) {
  const values = runtimeValues || [];
  if (!binding.containerInjections || !binding.containerInjections[property]) {
    return values;
  }
  const injections = binding.containerInjections[property].dependencies;
  const createError = binding.containerInjections[property].createError;
  if (values.length > injections.length) {
    if (debug_default.enabled) {
      debug_default('created resolver plan. target: "[class %s]", property: "%s", injections: %O', binding.name, property, values.map((value, index) => {
        if (value !== void 0) {
          return value;
        }
        return injections[index];
      }));
    }
    return Promise.all(values.map((value, index) => {
      if (value !== void 0) {
        return value;
      }
      const injection = injections[index];
      return resolver.resolveFor(binding, injection, void 0, createError);
    }));
  }
  if (debug_default.enabled) {
    debug_default('created resolver plan. target: "[class %s]", property: "%s", injections: %O', binding.name, property, injections.map((injection, index) => {
      if (values[index] !== void 0) {
        return values[index];
      }
      return injection;
    }));
  }
  return Promise.all(injections.map((injection, index) => {
    if (values[index] !== void 0) {
      return values[index];
    }
    return resolver.resolveFor(binding, injection, void 0, createError);
  }));
}
__name(containerProvider, "containerProvider");

// src/resolver.ts
var ContainerResolver = class {
  static {
    __name(this, "ContainerResolver");
  }
  /**
  * Reference to the container aliases. They are shared between the container
  * and resolver.
  *
  * We do not mutate this property within the resolver
  */
  #containerAliases;
  /**
  * Pre-registered contextual bindings. They are shared between the container
  * and resolver.
  *
  * We do not mutate this property within the resolver
  */
  #containerContextualBindings;
  /**
  * Pre-registered bindings. They are shared between the container
  * and resolver.
  *
  * We do not mutate this property within the resolver
  */
  #containerBindings;
  /**
  * Pre-registered bindings. They are shared between the container
  * and resolver.
  *
  * We mutate this property within the resolver to set singleton
  * cached values
  */
  #containerBindingValues;
  /**
  * Pre-registered swaps for bindings. They are shared between
  * the container and resolver.
  *
  * We do not mutate this property within the resolver
  */
  #containerSwaps;
  /**
  * Reference to the container hooks
  */
  #containerHooks;
  /**
  * Binding values local to the resolver
  */
  #bindingValues = /* @__PURE__ */ new Map();
  /**
  * Container options
  */
  #options;
  constructor(container, options) {
    this.#containerBindings = container.bindings;
    this.#containerBindingValues = container.bindingValues;
    this.#containerSwaps = container.swaps;
    this.#containerHooks = container.hooks;
    this.#containerAliases = container.aliases;
    this.#containerContextualBindings = container.contextualBindings;
    this.#options = options;
  }
  /**
  * Constructs exception for invalid binding value
  */
  #invalidBindingException(parent, binding, createError) {
    if (parent) {
      const error = createError(`Cannot inject "${inspect(binding)}" in "[class ${parent.name}]"`);
      error.help = "The value is not a valid class";
      return error;
    }
    return createError(`Cannot construct value "${inspect(binding)}" using container`);
  }
  /**
  * Constructs exception for binding with missing dependencies
  */
  #missingDependenciesException(parent, binding, createError) {
    if (parent) {
      const error = createError(`Cannot inject "[class ${binding.name}]" in "[class ${parent.name}]"`);
      error.help = `Container is not able to resolve "${parent.name}" class dependencies. Did you forget to use @inject() decorator?`;
      return error;
    }
    return createError(`Cannot construct "[class ${binding.name}]" class. Container is not able to resolve its dependencies. Did you forget to use @inject() decorator?`);
  }
  /**
  * Returns the provider for the class constructor
  */
  #getBindingProvider(binding) {
    return binding.containerProvider;
  }
  /**
  * Returns the binding resolver for a parent and a binding. Returns
  * undefined when no contextual binding exists
  */
  #getBindingResolver(parent, binding) {
    const parentBindings = this.#containerContextualBindings.get(parent);
    if (!parentBindings) {
      return;
    }
    const bindingResolver = parentBindings.get(binding);
    if (!bindingResolver) {
      return;
    }
    return bindingResolver.resolver;
  }
  /**
  * Notify emitter
  */
  #emit(binding, value) {
    if (!this.#options.emitter) {
      return;
    }
    this.#options.emitter.emit("container_binding:resolved", {
      binding,
      value
    });
  }
  /**
  * Execute hooks for a given binding
  */
  async #execHooks(binding, value) {
    const callbacks = this.#containerHooks.get(binding);
    if (!callbacks || callbacks.size === 0) {
      return;
    }
    for (let callback of callbacks) {
      await callback(value, this);
    }
  }
  hasBinding(binding) {
    return this.#containerAliases.has(binding) || this.#bindingValues.has(binding) || this.#containerBindingValues.has(binding) || this.#containerBindings.has(binding);
  }
  hasAllBindings(bindings) {
    return bindings.every((binding) => this.hasBinding(binding));
  }
  /**
  * Resolves binding in context of a parent. The method is same as
  * the "make" method, but instead takes a parent class
  * constructor.
  */
  async resolveFor(parent, binding, runtimeValues, createError = (message) => new RuntimeException2(message)) {
    const isAClass = isClass(binding);
    if (typeof binding !== "string" && typeof binding !== "symbol" && !isAClass) {
      throw this.#invalidBindingException(parent, binding, createError);
    }
    if (isAClass && this.#containerSwaps.has(binding)) {
      const resolver = this.#containerSwaps.get(binding);
      const value = await resolver(this, runtimeValues);
      if (debug_default.enabled) {
        debug_default("resolved swap for binding %O, resolved value :%O", binding, value);
      }
      await this.#execHooks(binding, value);
      this.#emit(binding, value);
      return value;
    }
    const contextualResolver = isAClass && this.#getBindingResolver(parent, binding);
    if (contextualResolver) {
      const value = await contextualResolver(this, runtimeValues);
      if (debug_default.enabled) {
        debug_default("resolved using contextual resolver binding %O, resolved value :%O", binding, value);
      }
      await this.#execHooks(binding, value);
      this.#emit(binding, value);
      return value;
    }
    if (this.#bindingValues.has(binding)) {
      const value = this.#bindingValues.get(binding);
      if (debug_default.enabled) {
        debug_default("resolved from resolver values %O, resolved value :%O", binding, value);
      }
      this.#emit(binding, value);
      return value;
    }
    if (this.#containerBindingValues.has(binding)) {
      const value = this.#containerBindingValues.get(binding);
      if (debug_default.enabled) {
        debug_default("resolved from container values %O, resolved value :%O", binding, value);
      }
      this.#emit(binding, value);
      return value;
    }
    if (this.#containerBindings.has(binding)) {
      const { resolver, isSingleton } = this.#containerBindings.get(binding);
      let value;
      let executeHooks = isSingleton ? false : true;
      if (isSingleton) {
        const result = await resolver(this, runtimeValues);
        value = result.value;
        executeHooks = !result.cached;
      } else {
        value = await resolver(this, runtimeValues);
      }
      if (debug_default.enabled) {
        debug_default("resolved binding %O, resolved value :%O", binding, value);
      }
      if (executeHooks) {
        await this.#execHooks(binding, value);
      }
      this.#emit(binding, value);
      return value;
    }
    if (isAClass) {
      let dependencies = [];
      const classConstructor = binding;
      const bindingProvider = this.#getBindingProvider(classConstructor);
      if (bindingProvider) {
        dependencies = await bindingProvider(classConstructor, "_constructor", this, containerProvider, runtimeValues);
      } else {
        dependencies = await containerProvider(classConstructor, "_constructor", this, runtimeValues);
      }
      if (dependencies.length < classConstructor.length) {
        throw this.#missingDependenciesException(parent, binding, createError);
      }
      const value = new binding(...dependencies);
      if (debug_default.enabled) {
        debug_default("constructed class %O, resolved value :%O", binding, value);
      }
      await this.#execHooks(binding, value);
      this.#emit(binding, value);
      return value;
    }
    throw createError(`Cannot resolve binding "${String(binding)}" from the container`);
  }
  async make(binding, runtimeValues, createError) {
    if (this.#containerAliases.has(binding)) {
      return this.resolveFor(null, this.#containerAliases.get(binding), runtimeValues, createError);
    }
    return this.resolveFor(null, binding, runtimeValues, createError);
  }
  /**
  * Call a method on an object by injecting its dependencies. The method
  * dependencies are resolved in the same manner as a class constructor
  * dependencies.
  *
  * ```ts
  * await resolver.call(await resolver.make(UsersController), 'index')
  * ```
  */
  async call(value, method, runtimeValues, createError = (message) => new RuntimeException2(message)) {
    if (typeof value[method] !== "function") {
      throw createError(`Missing method "${String(method)}" on "${inspect(value)}"`);
    }
    if (debug_default.enabled) {
      debug_default("calling method %s, on value :%O", method, value);
    }
    let dependencies = [];
    const binding = value.constructor;
    const bindingProvider = this.#getBindingProvider(binding);
    if (bindingProvider) {
      dependencies = await bindingProvider(binding, method, this, containerProvider, runtimeValues);
    } else {
      dependencies = await containerProvider(binding, method, this, runtimeValues);
    }
    if (dependencies.length < value[method].length) {
      throw createError(`Cannot call "${binding.name}.${String(method)}" method. Container is not able to resolve its dependencies. Did you forget to use @inject() decorator?`);
    }
    return value[method](...dependencies);
  }
  bindValue(binding, value) {
    if (typeof binding !== "string" && typeof binding !== "symbol" && !isClass(binding)) {
      throw new InvalidArgumentsException('The container binding key must be of type "string", "symbol", or a "class constructor"');
    }
    debug_default('adding value to resolver "%O"', binding);
    this.#bindingValues.set(binding, value);
  }
};

// src/contextual_bindings_builder.ts
import { RuntimeException as RuntimeException3 } from "@poppinss/utils/exception";
var ContextBindingsBuilder = class {
  static {
    __name(this, "ContextBindingsBuilder");
  }
  /**
  * The parent for whom to define the contextual
  * binding
  */
  #parent;
  /**
  * The binding the parent asks for
  */
  #binding;
  /**
  * Container instance for registering the contextual
  * bindings
  */
  #container;
  constructor(parent, container) {
    this.#parent = parent;
    this.#container = container;
  }
  /**
  * Specify the binding for which to register a custom
  * resolver.
  */
  asksFor(binding) {
    this.#binding = binding;
    return this;
  }
  /**
  * Provide a resolver to resolve the parent dependency
  */
  provide(resolver) {
    if (!this.#binding) {
      throw new RuntimeException3('Missing value for contextual binding. Call "asksFor" method before calling the "provide" method');
    }
    this.#container.contextualBinding(this.#parent, this.#binding, resolver);
  }
};

// src/container.ts
var Container = class {
  static {
    __name(this, "Container");
  }
  /**
  * A set of defined aliases for the bindings
  */
  #aliases = /* @__PURE__ */ new Map();
  /**
  * Contextual bindings are same as binding, but instead defined
  * for a parent class constructor.
  *
  * The contextual bindings can only be registered for class constructors, because
  * that is what gets injected to the class.
  */
  #contextualBindings = /* @__PURE__ */ new Map();
  /**
  * A collection of bindings with registered swapped implementations. Swaps can only
  * be define for a class, because the goal is swap the dependency tree defined
  * using the Inject decorator and inject decorator does not take anything
  * other than a class.
  */
  #swaps = /* @__PURE__ */ new Map();
  /**
  * Registered bindings. Singleton and normal bindings, both are
  * registered inside the bindings map
  */
  #bindings = /* @__PURE__ */ new Map();
  /**
  * Registered bindings as values. The values are preferred over the bindings.
  */
  #bindingValues = /* @__PURE__ */ new Map();
  /**
  * Registered hooks.
  */
  #hooks = /* @__PURE__ */ new Map();
  /**
  * Container options
  */
  #options;
  constructor(options) {
    this.#options = options || {};
  }
  /**
  * Define an emitter instance to use
  */
  useEmitter(emitter) {
    this.#options.emitter = emitter;
    return this;
  }
  /**
  * Create a container resolver to resolve bindings, or make classes.
  *
  * ```ts
  * const resolver = container.createResolver()
  * await resolver.make(CLASS_CONSTRUCTOR)
  * ```
  *
  * Bind values with the resolver. Resolver values are isolated from the
  * container.
  *
  * ```ts
  * resolver.bindValue(HttpContext, new HttpContext())
  * await resolver.make(UsersController)
  * ```
  */
  createResolver() {
    return new ContainerResolver({
      bindings: this.#bindings,
      bindingValues: this.#bindingValues,
      swaps: this.#swaps,
      hooks: this.#hooks,
      aliases: this.#aliases,
      contextualBindings: this.#contextualBindings
    }, this.#options);
  }
  hasBinding(binding) {
    return this.#aliases.has(binding) || this.#bindingValues.has(binding) || this.#bindings.has(binding);
  }
  hasAllBindings(bindings) {
    return bindings.every((binding) => this.hasBinding(binding));
  }
  make(binding, runtimeValues, createError) {
    return this.createResolver().make(binding, runtimeValues, createError);
  }
  /**
  * Call a method on an object by injecting its dependencies. The method
  * dependencies are resolved in the same manner as a class constructor
  * dependencies.
  *
  * ```ts
  * await container.call(await container.make(UsersController), 'index')
  * ```
  */
  call(value, method, runtimeValues, createError) {
    return this.createResolver().call(value, method, runtimeValues, createError);
  }
  /**
  * Register an alias for a binding. The value can be a reference
  * to an existing binding or to a class constructor that will
  * instantiate to the same value as the alias.
  */
  alias(alias, value) {
    if (typeof alias !== "string" && typeof alias !== "symbol") {
      throw new InvalidArgumentsException2('The container alias key must be of type "string" or "symbol"');
    }
    this.#aliases.set(alias, value);
  }
  bind(binding, resolver) {
    if (typeof binding !== "string" && typeof binding !== "symbol" && !isClass(binding)) {
      throw new InvalidArgumentsException2('The container binding key must be of type "string", "symbol", or a "class constructor"');
    }
    debug_default('adding binding to container "%O"', binding);
    this.#bindings.set(binding, {
      resolver,
      isSingleton: false
    });
  }
  bindValue(binding, value) {
    if (typeof binding !== "string" && typeof binding !== "symbol" && !isClass(binding)) {
      throw new InvalidArgumentsException2('The container binding key must be of type "string", "symbol", or a "class constructor"');
    }
    debug_default("adding value to container %O", binding);
    this.#bindingValues.set(binding, value);
  }
  singleton(binding, resolver) {
    if (typeof binding !== "string" && typeof binding !== "symbol" && !isClass(binding)) {
      throw new InvalidArgumentsException2('The container binding key must be of type "string", "symbol", or a "class constructor"');
    }
    debug_default("adding singleton to container %O", binding);
    this.#bindings.set(binding, {
      resolver: enqueue(resolver),
      isSingleton: true
    });
  }
  /**
  * Define a fake implementation for a binding or a class constructor.
  * Fakes have the highest priority when resolving dependencies
  * from the container.
  */
  swap(binding, resolver) {
    if (!isClass(binding)) {
      throw new InvalidArgumentsException2(`Cannot call swap on value "${inspect2(binding)}". Only classes can be swapped`);
    }
    debug_default("defining swap for %O", binding);
    this.#swaps.set(binding, resolver);
  }
  /**
  * Restore binding by removing its swap
  */
  restore(binding) {
    debug_default("removing swap for %s", binding);
    this.#swaps.delete(binding);
  }
  /**
  * Restore mentioned or all bindings by removing
  * their swaps
  */
  restoreAll(bindings) {
    if (!bindings) {
      debug_default("removing all swaps");
      this.#swaps.clear();
      return;
    }
    for (let binding of bindings) {
      this.restore(binding);
    }
  }
  resolving(binding, callback) {
    binding = this.#aliases.get(binding) || binding;
    if (!this.#hooks.has(binding)) {
      this.#hooks.set(binding, /* @__PURE__ */ new Set());
    }
    const callbacks = this.#hooks.get(binding);
    callbacks.add(callback);
  }
  /**
  * Create a contextual builder to define contextual bindings
  */
  when(parent) {
    return new ContextBindingsBuilder(parent, this);
  }
  /**
  * Add a contextual binding for a given class constructor. A
  * contextual takes a parent, parent's dependency and a callback
  * to self resolve the dependency.
  *
  * For example:
  * - When "UsersController"
  * - Asks for "Hash class"
  * - Provide "Argon2" implementation
  */
  contextualBinding(parent, binding, resolver) {
    if (!isClass(binding)) {
      throw new InvalidArgumentsException2(`The binding value for contextual binding should be class`);
    }
    if (!isClass(parent)) {
      throw new InvalidArgumentsException2(`The parent value for contextual binding should be class`);
    }
    debug_default("adding contextual binding %O to %O", binding, parent);
    if (!this.#contextualBindings.has(parent)) {
      this.#contextualBindings.set(parent, /* @__PURE__ */ new Map());
    }
    const parentBindings = this.#contextualBindings.get(parent);
    parentBindings.set(binding, {
      resolver
    });
  }
};

// src/decorators/inject.ts
import { defineStaticProperty } from "@poppinss/utils";
import { RuntimeException as RuntimeException4 } from "@poppinss/utils/exception";
function createDebuggingError(original) {
  return /* @__PURE__ */ __name(function createError(message) {
    const error = new RuntimeException4(message);
    error.stack = original.stack;
    return error;
  }, "createError");
}
__name(createDebuggingError, "createDebuggingError");
function initiateContainerInjections(target, method, createError) {
  defineStaticProperty(target, "containerInjections", {
    initialValue: {},
    strategy: "inherit"
  });
  target.containerInjections[method] = {
    createError,
    dependencies: []
  };
}
__name(initiateContainerInjections, "initiateContainerInjections");
function defineConstructorInjections(target, createError) {
  const params = Reflect.getMetadata("design:paramtypes", target);
  if (!params) {
    return;
  }
  initiateContainerInjections(target, "_constructor", createError);
  if (debug_default.enabled) {
    debug_default("defining constructor injections for %O, params %O", `[class: ${target.name}]`, params);
  }
  for (const param of params) {
    target.containerInjections._constructor.dependencies.push(param);
  }
}
__name(defineConstructorInjections, "defineConstructorInjections");
function defineMethodInjections(target, method, createError) {
  const constructor = target.constructor;
  const params = Reflect.getMetadata("design:paramtypes", target, method);
  if (!params) {
    return;
  }
  initiateContainerInjections(constructor, method, createError);
  if (debug_default.enabled) {
    debug_default("defining method injections for %O, method %O, params %O", `[class ${constructor.name}]`, method, params);
  }
  for (const param of params) {
    constructor.containerInjections[method].dependencies.push(param);
  }
}
__name(defineMethodInjections, "defineMethodInjections");
function inject() {
  const createError = createDebuggingError(new Error());
  function injectDecorator(target, propertyKey) {
    if (!propertyKey) {
      defineConstructorInjections(target, createError);
      return;
    }
    defineMethodInjections(target, propertyKey, createError);
  }
  __name(injectDecorator, "injectDecorator");
  return injectDecorator;
}
__name(inject, "inject");

// src/module_caller.ts
function moduleCaller(target, method) {
  return {
    /**
    * Converts the class reference to a callable function. Invoking this method
    * internally creates a new instance of the class using the container and
    * invokes the method using the container.
    *
    * You can create a callable function using the container instance as shown below
    *
    * ```ts
    * const fn = moduleCaller(HomeController, 'handle')
    *  .toCallable(container)
    *
    * // Call the function and pass context to it
    * await fn(ctx)
    * ```
    *
    * Another option is to not pass the container at the time of creating
    * the callable function, but instead pass a resolver instance at
    * the time of calling the function
    *
    * ```ts
    * const fn = moduleCaller(HomeController, 'handle')
    *  .toCallable()
    *
    * // Call the function and pass context to it
    * const resolver = container.createResolver()
    * await fn(resolver, ctx)
    * ```
    */
    toCallable(container) {
      if (container) {
        return async function(...args) {
          return container.call(await container.make(target), method, args);
        };
      }
      return async function(resolver, ...args) {
        return resolver.call(await resolver.make(target), method, args);
      };
    },
    /**
    * Converts the class reference to an object with handle method. Invoking this
    * method internally creates a new instance of the class using the container
    * and invokes the method using the container.
    *
    * You can create a handle method object using the container instance as shown below
    *
    * ```ts
    * const handler = moduleCaller(HomeController, 'handle')
    *  .toHandleMethod(container)
    *
    * // Call the function and pass context to it
    * await handler.handle(ctx)
    * ```
    *
    * Another option is to not pass the container at the time of creating
    * the handle method object, but instead pass a resolver instance at
    * the time of calling the function
    *
    * ```ts
    * const handler = moduleCaller(HomeController, 'handle')
    *  .toHandleMethod()
    *
    * // Call the function and pass context to it
    * const resolver = container.createResolver()
    * await handler.handle(resolver, ctx)
    * ```
    */
    toHandleMethod(container) {
      if (container) {
        return {
          name: `${target.name}.${method}`,
          async handle(...args) {
            return container.call(await container.make(target), method, args);
          }
        };
      }
      return {
        name: `${target.name}.${method}`,
        async handle(resolver, ...args) {
          return resolver.call(await resolver.make(target), method, args);
        }
      };
    }
  };
}
__name(moduleCaller, "moduleCaller");

// src/module_importer.ts
import { importDefault } from "@poppinss/utils";
function moduleImporter(importFn, method) {
  return {
    /**
    * Converts the module import function to a callable function. Invoking this
    * method run internally import the module, create a new instance of the
    * default export class using the container and invokes the method using
    * the container.
    *
    * You can create a callable function using the container instance as shown below
    *
    * ```ts
    * const fn = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
    *  .toCallable(container)
    *
    * // Call the function and pass context to it
    * await fn(ctx)
    * ```
    *
    * Another option is to not pass the container at the time of creating
    * the callable function, but instead pass a resolver instance at
    * the time of calling the function
    *
    * ```ts
    * const fn = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
    *  .toCallable()
    *
    * // Call the function and pass context to it
    * const resolver = container.createResolver()
    * await fn(resolver, ctx)
    * ```
    */
    toCallable(container) {
      let defaultExport = null;
      if (container) {
        return async function(...args) {
          if (!defaultExport || "hot" in import.meta) {
            defaultExport = await importDefault(importFn);
          }
          return container.call(await container.make(defaultExport), method, args);
        };
      }
      return async function(resolver, ...args) {
        if (!defaultExport || "hot" in import.meta) {
          defaultExport = await importDefault(importFn);
        }
        return resolver.call(await resolver.make(defaultExport), method, args);
      };
    },
    /**
    * Converts the module import function to an object with handle method. Invoking the
    * handle method run internally imports the module, create a new instance of
    * the default export class using the container and invokes the method using
    * the container.
    *
    * You can create a handle method object using the container instance as shown below
    *
    * ```ts
    * const handler = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
    *  .toHandleMethod(container)
    *
    * // Call the function and pass context to it
    * await handler.handle(ctx)
    * ```
    *
    * Another option is to not pass the container at the time of creating
    * the handle method object, but instead pass a resolver instance at
    * the time of calling the function
    *
    * ```ts
    * const handler = moduleImporter(() => import('#middleware/auth_middleware'), 'handle')
    *  .toHandleMethod()
    *
    * // Call the function and pass context to it
    * const resolver = container.createResolver()
    * await handler.handle(resolver, ctx)
    * ```
    */
    toHandleMethod(container) {
      let defaultExport = null;
      if (container) {
        return {
          name: importFn.name,
          async handle(...args) {
            if (!defaultExport || "hot" in import.meta) {
              defaultExport = await importDefault(importFn);
            }
            return container.call(await container.make(defaultExport), method, args);
          }
        };
      }
      return {
        name: importFn.name,
        async handle(resolver, ...args) {
          if (!defaultExport || "hot" in import.meta) {
            defaultExport = await importDefault(importFn);
          }
          return resolver.call(await resolver.make(defaultExport), method, args);
        }
      };
    }
  };
}
__name(moduleImporter, "moduleImporter");

// src/module_expression.ts
function moduleExpression(expression, parentURL) {
  return {
    /**
    * Parses a module expression to extract the module import path
    * and the method to call on the default exported class.
    *
    * ```ts
    * moduleExpression('#controllers/users_controller').parse()
    * // ['#controllers/users_controller', 'handle']
    * ```
    *
    * With method
    * ```ts
    * moduleExpression('#controllers/users_controller.index').parse()
    * // ['#controllers/users_controller', 'index']
    * ```
    */
    parse() {
      const parts = expression.split(".");
      if (parts.length === 1) {
        return [
          expression,
          "handle"
        ];
      }
      const method = parts.pop();
      return [
        parts.join("."),
        method
      ];
    },
    /**
    * Converts the module expression to a callable function. Invoking this
    * method run internally import the module, create a new instance of the
    * default export class using the container and invokes the method using
    * the container.
    *
    * You can create a callable function using the container instance as shown below
    *
    * ```ts
    * const fn = moduleExpression('#controllers/users_controller.index')
    *  .toCallable(container)
    *
    * // Call the function and pass context to it
    * await fn(ctx)
    * ```
    *
    * Another option is to not pass the container at the time of creating
    * the callable function, but instead pass a resolver instance at
    * the time of calling the function
    *
    * ```ts
    * const fn = moduleExpression('#controllers/users_controller.index')
    *  .toCallable()
    *
    * // Call the function and pass context to it
    * const resolver = container.createResolver()
    * await fn(resolver, ctx)
    * ```
    */
    toCallable(container) {
      let defaultExport = null;
      const [importPath, method] = this.parse();
      if (container) {
        return async function(...args) {
          if (!defaultExport || "hot" in import.meta) {
            defaultExport = await resolveDefault(importPath, parentURL);
          }
          return container.call(await container.make(defaultExport), method, args);
        };
      }
      return async function(resolver, ...args) {
        if (!defaultExport || "hot" in import.meta) {
          defaultExport = await resolveDefault(importPath, parentURL);
        }
        return resolver.call(await resolver.make(defaultExport), method, args);
      };
    },
    /**
    * Converts the module expression to an object with handle method. Invoking the
    * handle method run internally imports the module, create a new instance of
    * the default export class using the container and invokes the method using
    * the container.
    *
    * You can create a handle method object using the container instance as shown below
    *
    * ```ts
    * const handler = moduleExpression('#controllers/users_controller.index')
    *  .toHandleMethod(container)
    *
    * // Call the function and pass context to it
    * await handler.handle(ctx)
    * ```
    *
    * Another option is to not pass the container at the time of creating
    * the handle method object, but instead pass a resolver instance at
    * the time of calling the function
    *
    * ```ts
    * const handler = moduleExpression('#controllers/users_controller.index')
    *  .toHandleMethod()
    *
    * // Call the function and pass context to it
    * const resolver = container.createResolver()
    * await handler.handle(resolver, ctx)
    * ```
    */
    toHandleMethod(container) {
      let defaultExport = null;
      const [importPath, method] = this.parse();
      if (container) {
        return {
          async handle(...args) {
            if (!defaultExport || "hot" in import.meta) {
              defaultExport = await resolveDefault(importPath, parentURL);
            }
            return container.call(await container.make(defaultExport), method, args);
          }
        };
      }
      return {
        async handle(resolver, ...args) {
          if (!defaultExport || "hot" in import.meta) {
            defaultExport = await resolveDefault(importPath, parentURL);
          }
          return resolver.call(await resolver.make(defaultExport), method, args);
        }
      };
    }
  };
}
__name(moduleExpression, "moduleExpression");

// src/parse_binding_reference.ts
import { parseImports } from "parse-imports";
async function parseBindingReference(binding) {
  if (typeof binding === "string") {
    const tokens = binding.split(".");
    if (tokens.length === 1) {
      return {
        moduleNameOrPath: binding,
        method: "handle"
      };
    }
    return {
      method: tokens.pop(),
      moduleNameOrPath: tokens.join(".")
    };
  }
  const [bindingReference, method] = binding;
  const imports = [
    ...await parseImports(bindingReference.toString())
  ];
  const importedModule = imports.find(($import) => $import.isDynamicImport && $import.moduleSpecifier.value);
  if (importedModule) {
    return {
      moduleNameOrPath: importedModule.moduleSpecifier.value,
      method: method || "handle"
    };
  }
  return {
    moduleNameOrPath: bindingReference.name,
    method: method || "handle"
  };
}
__name(parseBindingReference, "parseBindingReference");

export {
  resolveDefault,
  ContainerResolver,
  Container,
  inject,
  moduleCaller,
  moduleImporter,
  moduleExpression,
  parseBindingReference
};
