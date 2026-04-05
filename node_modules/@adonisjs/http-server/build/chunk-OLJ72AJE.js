var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/router/route.ts
import is from "@sindresorhus/is";
import Macroable4 from "@poppinss/macroable";
import Middleware from "@poppinss/middleware";
import { RuntimeException as RuntimeException2 } from "@poppinss/utils";
import { moduleCaller, moduleImporter } from "@adonisjs/fold";

// src/router/factories/use_return_value.ts
function useReturnValue(ctx) {
  return function(value) {
    if (value !== void 0 && // Return value is explicitly defined
    !ctx.response.hasLazyBody && // Lazy body is not set
    value !== ctx.response) {
      ctx.response.send(value);
    }
  };
}

// src/router/executor.ts
function execute(route, resolver, ctx, errorResponder) {
  return route.middleware.runner().errorHandler((error) => errorResponder(error, ctx)).finalHandler(async () => {
    if (typeof route.handler === "function") {
      return Promise.resolve(route.handler(ctx)).then(useReturnValue(ctx));
    }
    return route.handler.handle(resolver, ctx).then(useReturnValue(ctx));
  }).run(async (middleware, next) => {
    if (typeof middleware === "function") {
      return middleware(ctx, next);
    }
    return middleware.handle(resolver, ctx, next, middleware.args);
  });
}

// src/helpers.ts
import Cache from "tmp-cache";
import { InvalidArgumentsException } from "@poppinss/utils";

// src/router/brisk.ts
import Macroable from "@poppinss/macroable";
var BriskRoute = class extends Macroable {
  /**
   * Route pattern
   */
  #pattern;
  /**
   * Matchers inherited from the router
   */
  #globalMatchers;
  /**
   * Reference to the AdonisJS application
   */
  #app;
  /**
   * Middleware registered on the router
   */
  #routerMiddleware;
  /**
   * Reference to route instance. Set after `setHandler` is called
   */
  route = null;
  constructor(app, routerMiddleware, options) {
    super();
    this.#app = app;
    this.#routerMiddleware = routerMiddleware;
    this.#pattern = options.pattern;
    this.#globalMatchers = options.globalMatchers;
  }
  /**
   * Set handler for the brisk route
   */
  setHandler(handler) {
    this.route = new Route(this.#app, this.#routerMiddleware, {
      pattern: this.#pattern,
      globalMatchers: this.#globalMatchers,
      methods: ["GET", "HEAD"],
      handler
    });
    return this.route;
  }
  /**
   * Redirects to a given route. Params from the original request will
   * be used when no custom params are defined.
   */
  redirect(identifier, params, options) {
    function redirectsToRoute(ctx) {
      const redirector = ctx.response.redirect();
      if (options?.status) {
        redirector.status(options.status);
      }
      return redirector.toRoute(identifier, params || ctx.params, options);
    }
    Object.defineProperty(redirectsToRoute, "listArgs", { value: identifier, writable: false });
    return this.setHandler(redirectsToRoute);
  }
  /**
   * Redirect request to a fixed URL
   */
  redirectToPath(url, options) {
    function redirectsToPath(ctx) {
      const redirector = ctx.response.redirect();
      if (options?.status) {
        redirector.status(options.status);
      }
      return redirector.toPath(url);
    }
    Object.defineProperty(redirectsToPath, "listArgs", { value: url, writable: false });
    return this.setHandler(redirectsToPath);
  }
};

// src/router/group.ts
import Macroable3 from "@poppinss/macroable";

// src/router/resource.ts
import string from "@poppinss/utils/string";
import Macroable2 from "@poppinss/macroable";
import { RuntimeException } from "@poppinss/utils";
var RouteResource = class extends Macroable2 {
  /**
   * Resource identifier. Nested resources are separated
   * with a dot notation
   */
  #resource;
  /**
   * The controller to handle resource routing requests
   */
  #controller;
  /**
   * Is it a shallow resource? Shallow resources URLs do not have parent
   * resource name and id once they can be identified with the id.
   */
  #shallow = false;
  /**
   * Matchers inherited from the router
   */
  #globalMatchers;
  /**
   * Reference to the AdonisJS application
   */
  #app;
  /**
   * Middleware registered on the router
   */
  #routerMiddleware;
  /**
   * Parameter names for the resources. Defaults to `id` for
   * a singular resource and `resource_id` for nested
   * resources.
   */
  #params = {};
  /**
   * Base name for the routes. We suffix action names
   * on top of the base name
   */
  #routesBaseName;
  /**
   * A collection of routes instances that belongs to this resource
   */
  routes = [];
  constructor(app, routerMiddleware, options) {
    super();
    this.#validateResourceName(options.resource);
    this.#app = app;
    this.#shallow = options.shallow;
    this.#routerMiddleware = routerMiddleware;
    this.#controller = options.controller;
    this.#globalMatchers = options.globalMatchers;
    this.#resource = this.#normalizeResourceName(options.resource);
    this.#routesBaseName = this.#getRoutesBaseName();
    this.#buildRoutes();
  }
  /**
   * Normalizes the resource name to dropping leading and trailing
   * slashes.
   */
  #normalizeResourceName(resource) {
    return resource.replace(/^\//, "").replace(/\/$/, "");
  }
  /**
   * Ensure resource name is not an empty string
   */
  #validateResourceName(resource) {
    if (!resource || resource === "/") {
      throw new RuntimeException(`Invalid resource name "${resource}"`);
    }
  }
  /**
   * Converting segments of a resource to snake case to
   * make the route name.
   */
  #getRoutesBaseName() {
    return this.#resource.split(".").map((token) => string.snakeCase(token)).join(".");
  }
  /**
   * Create a new route for the given pattern, methods and controller action
   */
  #createRoute(pattern, methods, action) {
    const route = new Route(this.#app, this.#routerMiddleware, {
      pattern,
      methods,
      handler: typeof this.#controller === "string" ? `${this.#controller}.${action}` : [this.#controller, action],
      globalMatchers: this.#globalMatchers
    });
    route.as(`${this.#routesBaseName}.${action}`);
    this.routes.push(route);
  }
  /**
   * Returns the `resource_id` name for a given resource. The
   * resource name is converted to singular form and
   * transformed to snake case.
   *
   * photos becomes photo_id
   * users becomes user_id
   */
  #getResourceId(resource) {
    return `${string.snakeCase(string.singular(resource))}_id`;
  }
  /**
   * Build routes for the given resource
   */
  #buildRoutes() {
    const resources = this.#resource.split(".");
    const mainResource = resources.pop();
    this.#params[mainResource] = ":id";
    const baseURI = `${resources.map((resource) => {
      const paramName = `:${this.#getResourceId(resource)}`;
      this.#params[resource] = paramName;
      return `${resource}/${paramName}`;
    }).join("/")}/${mainResource}`;
    this.#createRoute(baseURI, ["GET", "HEAD"], "index");
    this.#createRoute(`${baseURI}/create`, ["GET", "HEAD"], "create");
    this.#createRoute(baseURI, ["POST"], "store");
    this.#createRoute(`${this.#shallow ? mainResource : baseURI}/:id`, ["GET", "HEAD"], "show");
    this.#createRoute(`${this.#shallow ? mainResource : baseURI}/:id/edit`, ["GET", "HEAD"], "edit");
    this.#createRoute(`${this.#shallow ? mainResource : baseURI}/:id`, ["PUT", "PATCH"], "update");
    this.#createRoute(`${this.#shallow ? mainResource : baseURI}/:id`, ["DELETE"], "destroy");
  }
  /**
   * Filter the routes based on their partial names
   */
  #filter(names, inverse) {
    const actions = Array.isArray(names) ? names : [names];
    return this.routes.filter((route) => {
      const match = actions.find((name) => route.getName().endsWith(name));
      return inverse ? !match : match;
    });
  }
  /**
   * Register only given routes and remove others
   */
  only(names) {
    this.#filter(names, true).forEach((route) => route.markAsDeleted());
    return this;
  }
  /**
   * Register all routes, except the one's defined
   */
  except(names) {
    this.#filter(names, false).forEach((route) => route.markAsDeleted());
    return this;
  }
  /**
   * Register api only routes. The `create` and `edit` routes, which
   * are meant to show forms will not be registered
   */
  apiOnly() {
    return this.except(["create", "edit"]);
  }
  /**
   * Define matcher for params inside the resource
   */
  where(key, matcher) {
    this.routes.forEach((route) => {
      route.where(key, matcher);
    });
    return this;
  }
  tap(actions, callback) {
    if (typeof actions === "function") {
      this.routes.forEach((route) => {
        if (!route.isDeleted()) {
          actions(route);
        }
      });
      return this;
    }
    this.#filter(actions, false).forEach((route) => {
      if (!route.isDeleted()) {
        callback(route);
      }
    });
    return this;
  }
  /**
   * Set the param name for a given resource
   */
  params(resources) {
    Object.keys(resources).forEach((resource) => {
      const param = resources[resource];
      const existingParam = this.#params[resource];
      this.#params[resource] = `:${param}`;
      this.routes.forEach((route) => {
        route.setPattern(
          route.getPattern().replace(`${resource}/${existingParam}`, `${resource}/:${param}`)
        );
      });
    });
    return this;
  }
  /**
   * Define one or more middleware on the routes created by
   * the resource.
   *
   * Calling this method multiple times will append middleware
   * to existing list.
   */
  use(actions, middleware) {
    if (actions === "*") {
      this.tap((route) => route.use(middleware));
    } else {
      this.tap(actions, (route) => route.use(middleware));
    }
    return this;
  }
  /**
   * @alias use
   */
  middleware(actions, middleware) {
    return this.use(actions, middleware);
  }
  /**
   * Prepend name to all the routes
   */
  as(name, normalizeName = true) {
    name = normalizeName ? string.snakeCase(name) : name;
    this.routes.forEach((route) => {
      route.as(route.getName().replace(this.#routesBaseName, name), false);
    });
    this.#routesBaseName = name;
    return this;
  }
};

// src/router/group.ts
var RouteGroup = class _RouteGroup extends Macroable3 {
  constructor(routes) {
    super();
    this.routes = routes;
  }
  /**
   * Array of middleware registered on the group.
   */
  #middleware = [];
  /**
   * Shares midldeware stack with the routes. The method is invoked recursively
   * to only register middleware with the route class and not with the
   * resource or the child group
   */
  #shareMiddlewareStackWithRoutes(route) {
    if (route instanceof _RouteGroup) {
      route.routes.forEach((child) => this.#shareMiddlewareStackWithRoutes(child));
      return;
    }
    if (route instanceof RouteResource) {
      route.routes.forEach((child) => child.getMiddleware().unshift(this.#middleware));
      return;
    }
    if (route instanceof BriskRoute) {
      route.route.getMiddleware().unshift(this.#middleware);
      return;
    }
    route.getMiddleware().unshift(this.#middleware);
  }
  /**
   * Updates the route name. The method is invoked recursively to only update
   * the name with the route class and not with the resource or the child
   * group.
   */
  #updateRouteName(route, name) {
    if (route instanceof _RouteGroup) {
      route.routes.forEach((child) => this.#updateRouteName(child, name));
      return;
    }
    if (route instanceof RouteResource) {
      route.routes.forEach((child) => child.as(name, true));
      return;
    }
    if (route instanceof BriskRoute) {
      route.route.as(name, true);
      return;
    }
    route.as(name, true);
  }
  /**
   * Sets prefix on the route. The method is invoked recursively to only set
   * the prefix with the route class and not with the resource or the
   * child group.
   */
  #setRoutePrefix(route, prefix) {
    if (route instanceof _RouteGroup) {
      route.routes.forEach((child) => this.#setRoutePrefix(child, prefix));
      return;
    }
    if (route instanceof RouteResource) {
      route.routes.forEach((child) => child.prefix(prefix));
      return;
    }
    if (route instanceof BriskRoute) {
      route.route.prefix(prefix);
      return;
    }
    route.prefix(prefix);
  }
  /**
   * Updates domain on the route. The method is invoked recursively to only update
   * the domain with the route class and not with the resource or the child
   * group.
   */
  #updateRouteDomain(route, domain) {
    if (route instanceof _RouteGroup) {
      route.routes.forEach((child) => this.#updateRouteDomain(child, domain));
      return;
    }
    if (route instanceof RouteResource) {
      route.routes.forEach((child) => child.domain(domain));
      return;
    }
    if (route instanceof BriskRoute) {
      route.route.domain(domain, false);
      return;
    }
    route.domain(domain, false);
  }
  /**
   * Updates matchers on the route. The method is invoked recursively to only update
   * the matchers with the route class and not with the resource or the child
   * group.
   */
  #updateRouteMatchers(route, param, matcher) {
    if (route instanceof _RouteGroup) {
      route.routes.forEach((child) => this.#updateRouteMatchers(child, param, matcher));
      return;
    }
    if (route instanceof RouteResource) {
      route.routes.forEach((child) => child.where(param, matcher));
      return;
    }
    if (route instanceof BriskRoute) {
      route.route.where(param, matcher);
      return;
    }
    route.where(param, matcher);
  }
  /**
   * Define route param matcher
   *
   * ```ts
   * Route.group(() => {
   * }).where('id', /^[0-9]+/)
   * ```
   */
  where(param, matcher) {
    this.routes.forEach((route) => this.#updateRouteMatchers(route, param, matcher));
    return this;
  }
  /**
   * Define prefix all the routes in the group.
   *
   * ```ts
   * Route.group(() => {
   * }).prefix('v1')
   * ```
   */
  prefix(prefix) {
    this.routes.forEach((route) => this.#setRoutePrefix(route, prefix));
    return this;
  }
  /**
   * Define domain for all the routes.
   *
   * ```ts
   * Route.group(() => {
   * }).domain(':name.adonisjs.com')
   * ```
   */
  domain(domain) {
    this.routes.forEach((route) => this.#updateRouteDomain(route, domain));
    return this;
  }
  /**
   * Prepend name to the routes name.
   *
   * ```ts
   * Route.group(() => {
   * }).as('version1')
   * ```
   */
  as(name) {
    this.routes.forEach((route) => this.#updateRouteName(route, name));
    return this;
  }
  /**
   * Prepend an array of middleware to all routes middleware.
   *
   * ```ts
   * Route.group(() => {
   * }).use(middleware.auth())
   * ```
   */
  use(middleware) {
    if (!this.#middleware.length) {
      this.routes.forEach((route) => this.#shareMiddlewareStackWithRoutes(route));
    }
    if (Array.isArray(middleware)) {
      for (let one of middleware) {
        this.#middleware.push(one);
      }
    } else {
      this.#middleware.push(middleware);
    }
    return this;
  }
  /**
   * @alias use
   */
  middleware(middleware) {
    return this.use(middleware);
  }
};

// src/helpers.ts
var proxyCache = new Cache({ max: 200 });
function dropSlash(input) {
  if (input === "/") {
    return "/";
  }
  return `/${input.replace(/^\//, "").replace(/\/$/, "")}`;
}
function toRoutesJSON(routes) {
  return routes.reduce((list, route) => {
    if (route instanceof RouteGroup) {
      list = list.concat(toRoutesJSON(route.routes));
      return list;
    }
    if (route instanceof RouteResource) {
      list = list.concat(toRoutesJSON(route.routes));
      return list;
    }
    if (route instanceof BriskRoute) {
      if (route.route && !route.route.isDeleted()) {
        list.push(route.route.toJSON());
      }
      return list;
    }
    if (!route.isDeleted()) {
      list.push(route.toJSON());
    }
    return list;
  }, []);
}
function trustProxy(remoteAddress, proxyFn) {
  if (proxyCache.has(remoteAddress)) {
    return proxyCache.get(remoteAddress);
  }
  const result = proxyFn(remoteAddress, 0);
  proxyCache.set(remoteAddress, result);
  return result;
}
function parseRange(range, value) {
  const parts = range.split("..");
  const min = Number(parts[0]);
  const max = Number(parts[1]);
  if (parts.length === 1 && !Number.isNaN(min)) {
    return {
      [min]: value
    };
  }
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return {};
  }
  if (min === max) {
    return {
      [min]: value
    };
  }
  if (max < min) {
    throw new InvalidArgumentsException(`Invalid range "${range}"`);
  }
  return [...Array(max - min + 1).keys()].reduce(
    (result, step) => {
      result[min + step] = value;
      return result;
    },
    {}
  );
}

// src/debug.ts
import { debuglog } from "util";
var debug_default = debuglog("adonisjs:http");

// src/router/route.ts
var Route = class extends Macroable4 {
  /**
   * Route pattern
   */
  #pattern;
  /**
   * HTTP Methods for the route
   */
  #methods;
  /**
   * A unique name for the route
   */
  #name;
  /**
   * A boolean to prevent route from getting registered within
   * the store.
   *
   * This flag must be set before "Router.commit" method
   */
  #isDeleted = false;
  /**
   * Route handler
   */
  #handler;
  /**
   * Matchers inherited from the router
   */
  #globalMatchers;
  /**
   * Reference to the AdonisJS application
   */
  #app;
  /**
   * Middleware registered on the router
   */
  #routerMiddleware;
  /**
   * By default the route is part of the `root` domain. Root domain is used
   * when no domain is defined
   */
  #routeDomain = "root";
  /**
   * An object of matchers to be forwarded to the store. The matchers
   * list is populated by calling `where` method
   */
  #matchers = {};
  /**
   * Custom prefixes defined on the route or the route parent
   * groups
   */
  #prefixes = [];
  /**
   * Middleware defined directly on the route or the route parent
   * routes. We mantain an array for each layer of the stack
   */
  #middleware = [];
  constructor(app, routerMiddleware, options) {
    super();
    this.#app = app;
    this.#routerMiddleware = routerMiddleware;
    this.#pattern = options.pattern;
    this.#methods = options.methods;
    this.#handler = this.#resolveRouteHandle(options.handler);
    this.#globalMatchers = options.globalMatchers;
  }
  /**
   * Resolves the route handler string expression to a
   * handler method object
   */
  #resolveRouteHandle(handler) {
    if (typeof handler === "string") {
      const parts = handler.split(".");
      const method = parts.length === 1 ? "handle" : parts.pop();
      const moduleRefId = parts.join(".");
      return {
        reference: handler,
        ...moduleImporter(() => this.#app.import(moduleRefId), method).toHandleMethod(),
        name: handler
      };
    }
    if (Array.isArray(handler)) {
      if (is.class(handler[0])) {
        return {
          reference: handler,
          ...moduleCaller(handler[0], handler[1] || "handle").toHandleMethod()
        };
      }
      return {
        reference: handler,
        ...moduleImporter(handler[0], handler[1] || "handle").toHandleMethod()
      };
    }
    return handler;
  }
  /**
   * Returns an object of param matchers by merging global and local
   * matchers. The local copy is given preference over the global
   * one's
   */
  #getMatchers() {
    return { ...this.#globalMatchers, ...this.#matchers };
  }
  /**
   * Returns a normalized pattern string by prefixing the `prefix` (if defined).
   */
  #computePattern() {
    const pattern = dropSlash(this.#pattern);
    const prefix = this.#prefixes.slice().reverse().map((one) => dropSlash(one)).join("");
    return prefix ? `${prefix}${pattern === "/" ? "" : pattern}` : pattern;
  }
  /**
   * Define matcher for a given param. If a matcher exists, then we do not
   * override that, since the routes inside a group will set matchers
   * before the group, so they should have priority over the group
   * matchers.
   *
   * ```ts
   * Route.group(() => {
   *   Route.get('/:id', 'handler').where('id', /^[0-9]$/)
   * }).where('id', /[^a-z$]/)
   * ```
   *
   * The `/^[0-9]$/` will win over the matcher defined by the group
   */
  where(param, matcher) {
    if (this.#matchers[param]) {
      return this;
    }
    if (typeof matcher === "string") {
      this.#matchers[param] = { match: new RegExp(matcher) };
    } else if (is.regExp(matcher)) {
      this.#matchers[param] = { match: matcher };
    } else {
      this.#matchers[param] = matcher;
    }
    return this;
  }
  /**
   * Define prefix for the route. Calling this method multiple times
   * applies multiple prefixes in the reverse order.
   */
  prefix(prefix) {
    this.#prefixes.push(prefix);
    return this;
  }
  /**
   * Define a custom domain for the route. We do not overwrite the domain
   * unless `overwrite` flag is set to true.
   */
  domain(domain, overwrite = false) {
    if (this.#routeDomain === "root" || overwrite) {
      this.#routeDomain = domain;
    }
    return this;
  }
  /**
   * Define one or more middleware to be executed before the route
   * handler.
   *
   * Named middleware can be referenced using the name registered with
   * the router middleware store.
   */
  use(middleware) {
    this.#middleware.push(Array.isArray(middleware) ? middleware : [middleware]);
    return this;
  }
  /**
   * @alias use
   */
  middleware(middleware) {
    return this.use(middleware);
  }
  /**
   * Give a unique name to the route. Assinging a new unique removes the
   * existing name of the route.
   *
   * Setting prepends to true prefixes the name to the existing name.
   */
  as(name, prepend = false) {
    if (prepend) {
      if (!this.#name) {
        throw new RuntimeException2(
          `Routes inside a group must have names before calling "router.group.as"`
        );
      }
      this.#name = `${name}.${this.#name}`;
      return this;
    }
    this.#name = name;
    return this;
  }
  /**
   * Check if the route was marked to be deleted
   */
  isDeleted() {
    return this.#isDeleted;
  }
  /**
   * Mark route as deleted. Deleted routes are not registered
   * with the route store
   */
  markAsDeleted() {
    this.#isDeleted = true;
  }
  /**
   * Get the route name
   */
  getName() {
    return this.#name;
  }
  /**
   * Get the route pattern
   */
  getPattern() {
    return this.#pattern;
  }
  /**
   * Set the route pattern
   */
  setPattern(pattern) {
    this.#pattern = pattern;
    return this;
  }
  /**
   * Returns the stack of middleware registered on the route.
   * The value is shared by reference.
   */
  getMiddleware() {
    return this.#middleware;
  }
  /**
   * Returns the middleware instance for persistence inside the
   * store
   */
  #getMiddlewareForStore() {
    const middleware = new Middleware();
    this.#routerMiddleware.forEach((one) => {
      debug_default("adding global middleware to route %s, %O", this.#pattern, one);
      middleware.add(one);
    });
    this.#middleware.flat().forEach((one) => {
      debug_default("adding named middleware to route %s, %O", this.#pattern, one);
      middleware.add(one);
    });
    return middleware;
  }
  /**
   * Returns JSON representation of the route
   */
  toJSON() {
    return {
      domain: this.#routeDomain,
      pattern: this.#computePattern(),
      matchers: this.#getMatchers(),
      meta: {},
      name: this.#name,
      handler: this.#handler,
      methods: this.#methods,
      middleware: this.#getMiddlewareForStore(),
      execute
    };
  }
};

// src/cookies/drivers/plain.ts
import { base64, MessageBuilder } from "@poppinss/utils";
function pack(value) {
  if (value === void 0 || value === null) {
    return null;
  }
  return base64.urlEncode(new MessageBuilder().build(value));
}
function canUnpack(encodedValue) {
  return typeof encodedValue === "string";
}
function unpack(encodedValue) {
  return new MessageBuilder().verify(base64.urlDecode(encodedValue, "utf-8", false));
}

// src/cookies/drivers/signed.ts
function pack2(key, value, encryption) {
  if (value === void 0 || value === null) {
    return null;
  }
  return `s:${encryption.verifier.sign(value, void 0, key)}`;
}
function canUnpack2(signedValue) {
  return typeof signedValue === "string" && signedValue.substring(0, 2) === "s:";
}
function unpack2(key, signedValue, encryption) {
  const value = signedValue.slice(2);
  if (!value) {
    return null;
  }
  return encryption.verifier.unsign(value, key);
}

// src/cookies/drivers/encrypted.ts
function pack3(key, value, encryption) {
  if (value === void 0 || value === null) {
    return null;
  }
  return `e:${encryption.encrypt(value, void 0, key)}`;
}
function canUnpack3(encryptedValue) {
  return typeof encryptedValue === "string" && encryptedValue.substring(0, 2) === "e:";
}
function unpack3(key, encryptedValue, encryption) {
  const value = encryptedValue.slice(2);
  if (!value) {
    return null;
  }
  return encryption.decrypt(value, key);
}

// src/cookies/client.ts
var CookieClient = class {
  #encryption;
  constructor(encryption) {
    this.#encryption = encryption;
  }
  /**
   * Encrypt a key value pair to be sent in the cookie header
   */
  encrypt(key, value) {
    return pack3(key, value, this.#encryption);
  }
  /**
   * Sign a key value pair to be sent in the cookie header
   */
  sign(key, value) {
    return pack2(key, value, this.#encryption);
  }
  /**
   * Encode a key value pair to be sent in the cookie header
   */
  encode(_, value) {
    return pack(value);
  }
  /**
   * Unsign a signed cookie value
   */
  unsign(key, value) {
    return canUnpack2(value) ? unpack2(key, value, this.#encryption) : null;
  }
  /**
   * Decrypt an encrypted cookie value
   */
  decrypt(key, value) {
    return canUnpack3(value) ? unpack3(key, value, this.#encryption) : null;
  }
  /**
   * Decode an encoded cookie value
   */
  decode(_, value) {
    return canUnpack(value) ? unpack(value) : null;
  }
  /**
   * Parse response cookie
   */
  parse(key, value) {
    if (canUnpack2(value)) {
      return unpack2(key, value, this.#encryption);
    }
    if (canUnpack3(value)) {
      return unpack3(key, value, this.#encryption);
    }
    if (canUnpack(value)) {
      return unpack(value);
    }
  }
};

// src/request.ts
import fresh from "fresh";
import typeIs from "type-is";
import accepts from "accepts";
import { isIP } from "net";
import is2 from "@sindresorhus/is";
import proxyaddr from "proxy-addr";
import { safeEqual } from "@poppinss/utils";
import Macroable5 from "@poppinss/macroable";
import lodash from "@poppinss/utils/lodash";
import { createId } from "@paralleldrive/cuid2";
import { parse } from "url";

// src/cookies/parser.ts
import cookie from "cookie";
var CookieParser = class {
  #client;
  /**
   * A copy of cached cookies, they are cached during a request after
   * initial decoding, unsigning or decrypting.
   */
  #cachedCookies = {
    signedCookies: {},
    plainCookies: {},
    encryptedCookies: {}
  };
  /**
   * An object of key-value pair collected by parsing
   * the request cookie header.
   */
  #cookies;
  constructor(cookieHeader, encryption) {
    this.#client = new CookieClient(encryption);
    this.#cookies = this.#parse(cookieHeader);
  }
  /**
   * Parses the request `cookie` header
   */
  #parse(cookieHeader) {
    if (!cookieHeader) {
      return {};
    }
    return cookie.parse(cookieHeader);
  }
  /**
   * Attempts to decode a cookie by the name. When calling this method,
   * you are assuming that the cookie was just encoded in the first
   * place and not signed or encrypted.
   */
  decode(key, encoded = true) {
    const value = this.#cookies[key];
    if (value === null || value === void 0) {
      return null;
    }
    const cache = this.#cachedCookies.plainCookies;
    if (cache[key] !== void 0) {
      return cache[key];
    }
    const parsed = encoded ? this.#client.decode(key, value) : value;
    if (parsed !== null) {
      cache[key] = parsed;
    }
    return parsed;
  }
  /**
   * Attempts to unsign a cookie by the name. When calling this method,
   * you are assuming that the cookie was signed in the first place.
   */
  unsign(key) {
    const value = this.#cookies[key];
    if (value === null || value === void 0) {
      return null;
    }
    const cache = this.#cachedCookies.signedCookies;
    if (cache[key] !== void 0) {
      return cache[key];
    }
    const parsed = this.#client.unsign(key, value);
    if (parsed !== null) {
      cache[key] = parsed;
    }
    return parsed;
  }
  /**
   * Attempts to decrypt a cookie by the name. When calling this method,
   * you are assuming that the cookie was encrypted in the first place.
   */
  decrypt(key) {
    const value = this.#cookies[key];
    if (value === null || value === void 0) {
      return null;
    }
    const cache = this.#cachedCookies.encryptedCookies;
    if (cache[key] !== void 0) {
      return cache[key];
    }
    const parsed = this.#client.decrypt(key, value);
    if (parsed !== null) {
      cache[key] = parsed;
    }
    return parsed;
  }
  /**
   * Returns an object of cookies key-value pair. Do note, the
   * cookies are not decoded, unsigned or decrypted inside this
   * list.
   */
  list() {
    return this.#cookies;
  }
};

// src/request.ts
var Request = class extends Macroable5 {
  constructor(request, response, encryption, config, qsParser) {
    super();
    this.request = request;
    this.response = response;
    this.#qsParser = qsParser;
    this.#config = config;
    this.#encryption = encryption;
    this.parsedUrl = parse(this.request.url, false);
    this.#parseQueryString();
  }
  /**
   * Query string parser
   */
  #qsParser;
  /**
   * Encryption module to verify signed URLs and unsign/decrypt
   * cookies
   */
  #encryption;
  /**
   * Request config
   */
  #config;
  /**
   * Request body set using `setBody` method
   */
  #requestBody = {};
  /**
   * A merged copy of `request body` and `querystring`
   */
  #requestData = {};
  /**
   * Original merged copy of `request body` and `querystring`.
   * Further mutation to this object are not allowed
   */
  #originalRequestData = {};
  /**
   * Parsed query string
   */
  #requestQs = {};
  /**
   * Raw request body as text
   */
  #rawRequestBody;
  /**
   * Cached copy of `accepts` fn to do content
   * negotiation.
   */
  #lazyAccepts;
  /**
   * Copy of lazily parsed signed and plain cookies.
   */
  #cookieParser;
  /**
   * Parses copy of the URL with query string as a string and not
   * object. This is done to build URL's with query string without
   * stringifying the object
   */
  parsedUrl;
  /**
   * The ctx will be set by the context itself. It creates a circular
   * reference
   */
  ctx;
  /**
   * Parses the query string
   */
  #parseQueryString() {
    if (this.parsedUrl.query) {
      this.updateQs(this.#qsParser.parse(this.parsedUrl.query));
      this.#originalRequestData = { ...this.#requestData };
    }
  }
  /**
   * Initiates the cookie parser lazily
   */
  #initiateCookieParser() {
    if (!this.#cookieParser) {
      this.#cookieParser = new CookieParser(this.header("cookie"), this.#encryption);
    }
  }
  /**
   * Lazily initiates the `accepts` module to make sure to parse
   * the request headers only when one of the content-negotiation
   * methods are used.
   */
  #initiateAccepts() {
    this.#lazyAccepts = this.#lazyAccepts || accepts(this.request);
  }
  /**
   * Returns the request id from the `x-request-id` header. The
   * header is untouched, if it already exists.
   */
  id() {
    let requestId = this.header("x-request-id");
    if (!requestId && this.#config.generateRequestId) {
      requestId = createId();
      this.request.headers["x-request-id"] = requestId;
    }
    return requestId;
  }
  /**
   * Set initial request body. A copy of the input will be maintained as the original
   * request body. Since the request body and query string is subject to mutations, we
   * keep one original reference to flash old data (whenever required).
   *
   * This method is supposed to be invoked by the body parser and must be called only
   * once. For further mutations make use of `updateBody` method.
   */
  setInitialBody(body) {
    if (this.#originalRequestData && Object.isFrozen(this.#originalRequestData)) {
      throw new Error('Cannot re-set initial body. Use "request.updateBody" instead');
    }
    this.updateBody(body);
    this.#originalRequestData = Object.freeze(
      lodash.cloneDeepWith(this.#requestData, (value) => {
        if (is2.primitive(value) || Array.isArray(value) || is2.plainObject(value)) {
          return void 0;
        }
        return null;
      })
    );
  }
  /**
   * Update the request body with new data object. The `all` property
   * will be re-computed by merging the query string and request
   * body.
   */
  updateBody(body) {
    this.#requestBody = body;
    this.#requestData = { ...this.#requestBody, ...this.#requestQs };
  }
  /**
   * Update the request raw body. Bodyparser sets this when unable to parse
   * the request body or when request is multipart/form-data.
   */
  updateRawBody(rawBody) {
    this.#rawRequestBody = rawBody;
  }
  /**
   * Update the query string with the new data object. The `all` property
   * will be re-computed by merging the query and the request body.
   */
  updateQs(data) {
    this.#requestQs = data;
    this.#requestData = { ...this.#requestBody, ...this.#requestQs };
  }
  /**
   * Returns route params
   */
  params() {
    return this.ctx?.params || {};
  }
  /**
   * Returns the query string object by reference
   */
  qs() {
    return this.#requestQs;
  }
  /**
   * Returns reference to the request body
   */
  body() {
    return this.#requestBody;
  }
  /**
   * Returns reference to the merged copy of request body
   * and query string
   */
  all() {
    return this.#requestData;
  }
  /**
   * Returns reference to the merged copy of original request
   * query string and body
   */
  original() {
    return this.#originalRequestData;
  }
  /**
   * Returns the request raw body (if exists), or returns `null`.
   *
   * Ideally you must be dealing with the parsed body accessed using [[input]], [[all]] or
   * [[post]] methods. The `raw` body is always a string.
   */
  raw() {
    return this.#rawRequestBody || null;
  }
  /**
   * Returns value for a given key from the request body or query string.
   * The `defaultValue` is used when original value is `undefined`.
   *
   * @example
   * ```js
   * request.input('username')
   *
   * // with default value
   * request.input('username', 'virk')
   * ```
   */
  input(key, defaultValue) {
    return lodash.get(this.#requestData, key, defaultValue);
  }
  /**
   * Returns value for a given key from route params
   *
   * @example
   * ```js
   * request.param('id')
   *
   * // with default value
   * request.param('id', 1)
   * ```
   */
  param(key, defaultValue) {
    return lodash.get(this.params(), key, defaultValue);
  }
  /**
   * Get everything from the request body except the given keys.
   *
   * @example
   * ```js
   * request.except(['_csrf'])
   * ```
   */
  except(keys) {
    return lodash.omit(this.#requestData, keys);
  }
  /**
   * Get value for specified keys.
   *
   * @example
   * ```js
   * request.only(['username', 'age'])
   * ```
   */
  only(keys) {
    return lodash.pick(this.#requestData, keys);
  }
  /**
   * Returns the HTTP request method. This is the original
   * request method. For spoofed request method, make
   * use of [[method]].
   *
   * @example
   * ```js
   * request.intended()
   * ```
   */
  intended() {
    return this.request.method;
  }
  /**
   * Returns the request HTTP method by taking method spoofing into account.
   *
   * Method spoofing works when all of the following are true.
   *
   * 1. `app.http.allowMethodSpoofing` config value is true.
   * 2. request query string has `_method`.
   * 3. The [[intended]] request method is `POST`.
   *
   * @example
   * ```js
   * request.method()
   * ```
   */
  method() {
    if (this.#config.allowMethodSpoofing && this.intended() === "POST") {
      return this.input("_method", this.intended()).toUpperCase();
    }
    return this.intended();
  }
  /**
   * Returns a copy of headers as an object
   */
  headers() {
    return this.request.headers;
  }
  /**
   * Returns value for a given header key. The default value is
   * used when original value is `undefined`.
   */
  header(key, defaultValue) {
    key = key.toLowerCase();
    const headers = this.headers();
    switch (key) {
      case "referer":
      case "referrer":
        return headers.referrer || headers.referer || defaultValue;
      default:
        return headers[key] || defaultValue;
    }
  }
  /**
   * Returns the ip address of the user. This method is optimize to fetch
   * ip address even when running your AdonisJs app behind a proxy.
   *
   * You can also define your own custom function to compute the ip address by
   * defining `app.http.getIp` as a function inside the config file.
   *
   * ```js
   * {
   *   http: {
   *     getIp (request) {
   *       // I am using nginx as a proxy server and want to trust 'x-real-ip'
   *       return request.header('x-real-ip')
   *     }
   *   }
   * }
   * ```
   *
   * You can control the behavior of trusting the proxy values by defining it
   * inside the `config/app.js` file.
   *
   * ```js
   * {
   *   http: {
   *    trustProxy: '127.0.0.1'
   *   }
   * }
   * ```
   *
   * The value of trustProxy is passed directly to [proxy-addr](https://www.npmjs.com/package/proxy-addr)
   */
  ip() {
    const ipFn = this.#config.getIp;
    if (typeof ipFn === "function") {
      return ipFn(this);
    }
    return proxyaddr(this.request, this.#config.trustProxy);
  }
  /**
   * Returns an array of ip addresses from most to least trusted one.
   * This method is optimize to fetch ip address even when running
   * your AdonisJs app behind a proxy.
   *
   * You can control the behavior of trusting the proxy values by defining it
   * inside the `config/app.js` file.
   *
   * ```js
   * {
   *   http: {
   *    trustProxy: '127.0.0.1'
   *   }
   * }
   * ```
   *
   * The value of trustProxy is passed directly to [proxy-addr](https://www.npmjs.com/package/proxy-addr)
   */
  ips() {
    return proxyaddr.all(this.request, this.#config.trustProxy);
  }
  /**
   * Returns the request protocol by checking for the URL protocol or
   * `X-Forwarded-Proto` header.
   *
   * If the `trust` is evaluated to `false`, then URL protocol is returned,
   * otherwise `X-Forwarded-Proto` header is used (if exists).
   *
   * You can control the behavior of trusting the proxy values by defining it
   * inside the `config/app.js` file.
   *
   * ```js
   * {
   *   http: {
   *    trustProxy: '127.0.0.1'
   *   }
   * }
   * ```
   *
   * The value of trustProxy is passed directly to [proxy-addr](https://www.npmjs.com/package/proxy-addr)
   */
  protocol() {
    if ("encrypted" in this.request.socket) {
      return "https";
    }
    if (!trustProxy(this.request.socket.remoteAddress, this.#config.trustProxy)) {
      return this.parsedUrl.protocol || "http";
    }
    const forwardedProtocol = this.header("X-Forwarded-Proto");
    return forwardedProtocol ? forwardedProtocol.split(/\s*,\s*/)[0] : "http";
  }
  /**
   * Returns a boolean telling if request is served over `https`
   * or not. Check [[protocol]] method to know how protocol is
   * fetched.
   */
  secure() {
    return this.protocol() === "https";
  }
  /**
   * Returns the request host. If proxy headers are trusted, then
   * `X-Forwarded-Host` is given priority over the `Host` header.
   *
   * You can control the behavior of trusting the proxy values by defining it
   * inside the `config/app.js` file.
   *
   * ```js
   * {
   *   http: {
   *    trustProxy: '127.0.0.1'
   *   }
   * }
   * ```
   *
   * The value of trustProxy is passed directly to [proxy-addr](https://www.npmjs.com/package/proxy-addr)
   */
  host() {
    let host = this.header("host");
    if (trustProxy(this.request.socket.remoteAddress, this.#config.trustProxy)) {
      host = this.header("X-Forwarded-Host") || host;
    }
    if (!host) {
      return null;
    }
    return host;
  }
  /**
   * Returns the request hostname. If proxy headers are trusted, then
   * `X-Forwarded-Host` is given priority over the `Host` header.
   *
   * You can control the behavior of trusting the proxy values by defining it
   * inside the `config/app.js` file.
   *
   * ```js
   * {
   *   http: {
   *    trustProxy: '127.0.0.1'
   *   }
   * }
   * ```
   *
   * The value of trustProxy is passed directly to [proxy-addr](https://www.npmjs.com/package/proxy-addr)
   */
  hostname() {
    const host = this.host();
    if (!host) {
      return null;
    }
    const offset = host[0] === "[" ? host.indexOf("]") + 1 : 0;
    const index = host.indexOf(":", offset);
    return index !== -1 ? host.substring(0, index) : host;
  }
  /**
   * Returns an array of subdomains for the given host. An empty array is
   * returned if [[hostname]] is `null` or is an IP address.
   *
   * Also `www` is not considered as a subdomain
   */
  subdomains() {
    const hostname = this.hostname();
    if (!hostname || isIP(hostname)) {
      return [];
    }
    const offset = this.#config.subdomainOffset;
    const subdomains = hostname.split(".").reverse().slice(offset);
    if (subdomains[subdomains.length - 1] === "www") {
      subdomains.splice(subdomains.length - 1, 1);
    }
    return subdomains;
  }
  /**
   * Returns a boolean telling, if request `X-Requested-With === 'xmlhttprequest'`
   * or not.
   */
  ajax() {
    const xRequestedWith = this.header("X-Requested-With", "");
    return xRequestedWith.toLowerCase() === "xmlhttprequest";
  }
  /**
   * Returns a boolean telling, if request has `X-Pjax` header
   * set or not
   */
  pjax() {
    return !!this.header("X-Pjax");
  }
  /**
   * Returns the request relative URL.
   *
   * @example
   * ```js
   * request.url()
   *
   * // include query string
   * request.url(true)
   * ```
   */
  url(includeQueryString) {
    const pathname = this.parsedUrl.pathname;
    return includeQueryString && this.parsedUrl.query ? `${pathname}?${this.parsedUrl.query}` : pathname;
  }
  /**
   * Returns the complete HTTP url by combining
   * [[protocol]]://[[hostname]]/[[url]]
   *
   * @example
   * ```js
   * request.completeUrl()
   *
   * // include query string
   * request.completeUrl(true)
   * ```
   */
  completeUrl(includeQueryString) {
    const protocol = this.protocol();
    const hostname = this.host();
    return `${protocol}://${hostname}${this.url(includeQueryString)}`;
  }
  /**
   * Find if the current HTTP request is for the given route or the routes
   */
  matchesRoute(routeIdentifier) {
    if (!this.ctx || !this.ctx.route) {
      return false;
    }
    const route = this.ctx.route;
    return !!(Array.isArray(routeIdentifier) ? routeIdentifier : [routeIdentifier]).find(
      (identifier) => {
        if (route.pattern === identifier || route.name === identifier) {
          return true;
        }
        if (typeof route.handler === "function") {
          return false;
        }
        return route.handler.reference === identifier;
      }
    );
  }
  /**
   * Returns the best matching content type of the request by
   * matching against the given types.
   *
   * The content type is picked from the `content-type` header and request
   * must have body.
   *
   * The method response highly depends upon the types array values. Described below:
   *
   * | Type(s) | Return value |
   * |----------|---------------|
   * | ['json'] | json |
   * | ['application/*'] | application/json |
   * | ['vnd+json'] | application/json |
   *
   * @example
   * ```js
   * const bodyType = request.is(['json', 'xml'])
   *
   * if (bodyType === 'json') {
   *  // process JSON
   * }
   *
   * if (bodyType === 'xml') {
   *  // process XML
   * }
   * ```
   */
  is(types) {
    return typeIs(this.request, types) || null;
  }
  /**
   * Returns the best type using `Accept` header and
   * by matching it against the given types.
   *
   * If nothing is matched, then `null` will be returned
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   *
   * @example
   * ```js
   * switch (request.accepts(['json', 'html'])) {
   *   case 'json':
   *     return response.json(user)
   *   case 'html':
   *     return view.render('user', { user })
   *   default:
   *     // decide yourself
   * }
   * ```
   */
  accepts(types) {
    this.#initiateAccepts();
    return this.#lazyAccepts.type(types) || null;
  }
  /**
   * Return the types that the request accepts, in the order of the
   * client's preference (most preferred first).
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   */
  types() {
    this.#initiateAccepts();
    return this.#lazyAccepts.types();
  }
  /**
   * Returns the best language using `Accept-language` header
   * and by matching it against the given languages.
   *
   * If nothing is matched, then `null` will be returned
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   *
   * @example
   * ```js
   * switch (request.language(['fr', 'de'])) {
   *   case 'fr':
   *     return view.render('about', { lang: 'fr' })
   *   case 'de':
   *     return view.render('about', { lang: 'de' })
   *   default:
   *     return view.render('about', { lang: 'en' })
   * }
   * ```
   */
  language(languages) {
    this.#initiateAccepts();
    return this.#lazyAccepts.language(languages) || null;
  }
  /**
   * Return the languages that the request accepts, in the order of the
   * client's preference (most preferred first).
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   */
  languages() {
    this.#initiateAccepts();
    return this.#lazyAccepts.languages();
  }
  /**
   * Returns the best charset using `Accept-charset` header
   * and by matching it against the given charsets.
   *
   * If nothing is matched, then `null` will be returned
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   *
   * @example
   * ```js
   * switch (request.charset(['utf-8', 'ISO-8859-1'])) {
   *   case 'utf-8':
   *     // make utf-8 friendly response
   *   case 'ISO-8859-1':
   *     // make ISO-8859-1 friendly response
   * }
   * ```
   */
  charset(charsets) {
    this.#initiateAccepts();
    return this.#lazyAccepts.charset(charsets) || null;
  }
  /**
   * Return the charsets that the request accepts, in the order of the
   * client's preference (most preferred first).
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   */
  charsets() {
    this.#initiateAccepts();
    return this.#lazyAccepts.charsets();
  }
  /**
   * Returns the best encoding using `Accept-encoding` header
   * and by matching it against the given encodings.
   *
   * If nothing is matched, then `null` will be returned
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   */
  encoding(encodings) {
    this.#initiateAccepts();
    return this.#lazyAccepts.encoding(encodings) || null;
  }
  /**
   * Return the charsets that the request accepts, in the order of the
   * client's preference (most preferred first).
   *
   * Make sure to check [accepts](https://www.npmjs.com/package/accepts) package
   * docs too.
   */
  encodings() {
    this.#initiateAccepts();
    return this.#lazyAccepts.encodings();
  }
  /**
   * Returns a boolean telling if request has body
   */
  hasBody() {
    return typeIs.hasBody(this.request);
  }
  /**
   * Returns a boolean telling if the new response etag evaluates same
   * as the request header `if-none-match`. In case of `true`, the
   * server must return `304` response, telling the browser to
   * use the client cache.
   *
   * You won't have to deal with this method directly, since AdonisJs will
   * handle this for you when `http.etag = true` inside `config/app.js` file.
   *
   * However, this is how you can use it manually.
   *
   * ```js
   * const responseBody = view.render('some-view')
   *
   * // sets the HTTP etag header for response
   * response.setEtag(responseBody)
   *
   * if (request.fresh()) {
   *   response.sendStatus(304)
   * } else {
   *   response.send(responseBody)
   * }
   * ```
   */
  fresh() {
    if (["GET", "HEAD"].indexOf(this.intended()) === -1) {
      return false;
    }
    const status = this.response.statusCode;
    if (status >= 200 && status < 300 || status === 304) {
      return fresh(this.headers(), this.response.getHeaders());
    }
    return false;
  }
  /**
   * Opposite of [[fresh]]
   */
  stale() {
    return !this.fresh();
  }
  /**
   * Returns all parsed and signed cookies. Signed cookies ensures
   * that their value isn't tampered.
   */
  cookiesList() {
    this.#initiateCookieParser();
    return this.#cookieParser.list();
  }
  /**
   * Returns value for a given key from signed cookies. Optional
   * defaultValue is returned when actual value is undefined.
   */
  cookie(key, defaultValue) {
    this.#initiateCookieParser();
    return this.#cookieParser.unsign(key) || defaultValue;
  }
  /**
   * Returns value for a given key from signed cookies. Optional
   * defaultValue is returned when actual value is undefined.
   */
  encryptedCookie(key, defaultValue) {
    this.#initiateCookieParser();
    return this.#cookieParser.decrypt(key) || defaultValue;
  }
  plainCookie(key, defaultValueOrOptions, encoded) {
    this.#initiateCookieParser();
    if (is2.object(defaultValueOrOptions)) {
      return this.#cookieParser.decode(key, defaultValueOrOptions?.encoded) || defaultValueOrOptions.defaultValue;
    }
    return this.#cookieParser.decode(key, encoded) || defaultValueOrOptions;
  }
  /**
   * Returns a boolean telling if a signed url as a valid signature
   * or not.
   */
  hasValidSignature(purpose) {
    const { signature, ...rest } = this.qs();
    if (!signature) {
      return false;
    }
    const signedUrl = this.#encryption.verifier.unsign(signature, purpose);
    if (!signedUrl) {
      return false;
    }
    const queryString = this.#qsParser.stringify(rest);
    return queryString ? safeEqual(signedUrl, `${this.url()}?${queryString}`) : safeEqual(signedUrl, this.url());
  }
  /**
   * Serializes request to JSON format
   */
  serialize() {
    return {
      id: this.id(),
      url: this.url(),
      query: this.parsedUrl.query,
      body: this.all(),
      params: this.params(),
      headers: this.headers(),
      method: this.method(),
      protocol: this.protocol(),
      cookies: this.cookiesList(),
      hostname: this.hostname(),
      ip: this.ip(),
      subdomains: this.ctx?.subdomains || {}
    };
  }
  /**
   * toJSON copy of the request
   */
  toJSON() {
    return this.serialize();
  }
};

// src/redirect.ts
import { parse as parse2 } from "url";
import encodeUrl from "encodeurl";
var Redirect = class {
  /**
   * A boolean to forward the existing query string
   */
  #forwardQueryString = false;
  /**
   * The status code for the redirect
   */
  #statusCode = 302;
  /**
   * A custom query string to forward
   */
  #queryString = {};
  #request;
  #response;
  #router;
  #qs;
  constructor(request, response, router, qs) {
    this.#request = request;
    this.#response = response;
    this.#router = router;
    this.#qs = qs;
  }
  /**
   * Sends response by setting require headers
   */
  #sendResponse(url, query) {
    const stringified = this.#qs.stringify(query);
    url = stringified ? `${url}?${stringified}` : url;
    debug_default('redirecting to url "%s"', url);
    this.#response.location(encodeUrl(url));
    this.#response.safeStatus(this.#statusCode);
    this.#response.type("text/plain; charset=utf-8");
    this.#response.send(`Redirecting to ${url}`);
  }
  /**
   * Returns the referrer url
   */
  #getReferrerUrl() {
    let url = this.#request.headers["referer"] || this.#request.headers["referrer"] || "/";
    return Array.isArray(url) ? url[0] : url;
  }
  /**
   * Set a custom status code.
   */
  status(statusCode) {
    this.#statusCode = statusCode;
    return this;
  }
  /**
   * Clearing query string values added using the
   * "withQs" method
   */
  clearQs() {
    this.#forwardQueryString = false;
    this.#queryString = {};
    return this;
  }
  withQs(name, value) {
    if (typeof name === "undefined") {
      this.#forwardQueryString = true;
      return this;
    }
    if (typeof name === "string") {
      this.#queryString[name] = value;
      return this;
    }
    Object.assign(this.#queryString, name);
    return this;
  }
  /**
   * Redirect to the previous path.
   */
  back() {
    let query = {};
    const referrerUrl = this.#getReferrerUrl();
    const url = parse2(referrerUrl);
    debug_default('referrer url "%s"', referrerUrl);
    debug_default('referrer base url "%s"', url.pathname);
    if (this.#forwardQueryString) {
      query = this.#qs.parse(url.query || "");
    }
    Object.assign(query, this.#queryString);
    this.#sendResponse(url.pathname || "", query);
  }
  /**
   * Redirect the request using a route identifier.
   */
  toRoute(routeIdentifier, params, options) {
    if (options && options.qs) {
      this.withQs(options.qs);
      options.qs = void 0;
    }
    const url = this.#router.makeUrl(routeIdentifier, params, options);
    return this.toPath(url);
  }
  /**
   * Redirect the request using a path.
   */
  toPath(url) {
    let query = {};
    if (this.#forwardQueryString) {
      query = this.#qs.parse(parse2(this.#request.url).query || "");
    }
    Object.assign(query, this.#queryString);
    this.#sendResponse(url, query);
  }
};

// src/exceptions.ts
var exceptions_exports = {};
__export(exceptions_exports, {
  E_CANNOT_LOOKUP_ROUTE: () => E_CANNOT_LOOKUP_ROUTE,
  E_HTTP_EXCEPTION: () => E_HTTP_EXCEPTION,
  E_HTTP_REQUEST_ABORTED: () => E_HTTP_REQUEST_ABORTED,
  E_ROUTE_NOT_FOUND: () => E_ROUTE_NOT_FOUND
});
import { createError, Exception } from "@poppinss/utils";
var E_ROUTE_NOT_FOUND = createError(
  "Cannot %s:%s",
  "E_ROUTE_NOT_FOUND",
  404
);
var E_CANNOT_LOOKUP_ROUTE = createError(
  'Cannot lookup route "%s"',
  "E_CANNOT_LOOKUP_ROUTE",
  500
);
var E_HTTP_EXCEPTION = class HttpException extends Exception {
  body;
  static code = "E_HTTP_EXCEPTION";
  /**
   * This method returns an instance of the exception class
   */
  static invoke(body, status, code = "E_HTTP_EXCEPTION") {
    if (body === null || body === void 0) {
      const error2 = new this("HTTP Exception", { status, code });
      error2.body = "Internal server error";
      return error2;
    }
    if (typeof body === "object") {
      const error2 = new this(body.message || "HTTP Exception", { status, code });
      error2.body = body;
      return error2;
    }
    const error = new this(body, { status, code });
    error.body = body;
    return error;
  }
};
var E_HTTP_REQUEST_ABORTED = class AbortException extends E_HTTP_EXCEPTION {
  handle(error, ctx) {
    ctx.response.status(error.status).send(error.body);
  }
};

// src/response_status.ts
var ResponseStatus = {
  Continue: 100,
  SwitchingProtocols: 101,
  Processing: 102,
  EarlyHints: 103,
  Ok: 200,
  Created: 201,
  Accepted: 202,
  NonAuthoritativeInformation: 203,
  NoContent: 204,
  ResetContent: 205,
  PartialContent: 206,
  MultiStatus: 207,
  AlreadyReported: 208,
  IMUsed: 226,
  MultipleChoices: 300,
  MovedPermanently: 301,
  Found: 302,
  SeeOther: 303,
  NotModified: 304,
  UseProxy: 305,
  TemporaryRedirect: 307,
  PermanentRedirect: 308,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  NotAcceptable: 406,
  ProxyAuthenticationRequired: 407,
  RequestTimeout: 408,
  Conflict: 409,
  Gone: 410,
  LengthRequired: 411,
  PreconditionFailed: 412,
  PayloadTooLarge: 413,
  URITooLong: 414,
  UnsupportedMediaType: 415,
  RangeNotSatisfiable: 416,
  ExpectationFailed: 417,
  ImATeapot: 418,
  MisdirectedRequest: 421,
  UnprocessableEntity: 422,
  Locked: 423,
  FailedDependency: 424,
  TooEarly: 425,
  UpgradeRequired: 426,
  PreconditionRequired: 428,
  TooManyRequests: 429,
  RequestHeaderFieldsTooLarge: 431,
  UnavailableForLegalReasons: 451,
  InternalServerError: 500,
  NotImplemented: 501,
  BadGateway: 502,
  ServiceUnavailable: 503,
  GatewayTimeout: 504,
  HTTPVersionNotSupported: 505,
  VariantAlsoNegotiates: 506,
  InsufficientStorage: 507,
  LoopDetected: 508,
  NotExtended: 510,
  NetworkAuthenticationRequired: 511
};

// src/response.ts
import { Buffer as Buffer2 } from "buffer";
import etag from "etag";
import vary from "vary";
import fresh2 from "fresh";
import mime from "mime-types";
import destroy from "destroy";
import { extname } from "path";
import onFinished from "on-finished";
import json from "@poppinss/utils/json";
import Macroable6 from "@poppinss/macroable";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { RuntimeException as RuntimeException3 } from "@poppinss/utils";
import contentDisposition from "content-disposition";

// src/cookies/serializer.ts
import cookie2 from "cookie";
import string2 from "@poppinss/utils/string";
var CookieSerializer = class {
  #client;
  constructor(encryption) {
    this.#client = new CookieClient(encryption);
  }
  /**
   * Serializes the key-value pair to a string, that can be set on the
   * `Set-Cookie` header.
   */
  #serializeAsCookie(key, value, options) {
    let expires = options?.expires;
    if (typeof expires === "function") {
      expires = expires();
    }
    let maxAge = options?.maxAge ? string2.seconds.parse(options?.maxAge) : void 0;
    const parsedOptions = Object.assign({}, options, { maxAge, expires });
    return cookie2.serialize(key, value, parsedOptions);
  }
  /**
   * Encodes value as a plain cookie. By default, the plain value will be converted
   * to a string using "JSON.stringify" method and then encoded as a base64 string.
   *
   * You can disable encoding of the cookie by setting `options.encoded = false`.
   *
   * ```ts
   *  serializer.encode('name', 'virk')
   * ```
   */
  encode(key, value, options) {
    const packedValue = options?.encode === false ? value : this.#client.encode(key, value);
    if (packedValue === null || packedValue === void 0) {
      return null;
    }
    return this.#serializeAsCookie(key, packedValue, options);
  }
  /**
   * Sign a key-value pair to a signed cookie. The signed value has a
   * verification hash attached to it to detect data tampering.
   */
  sign(key, value, options) {
    const packedValue = this.#client.sign(key, value);
    if (packedValue === null) {
      return null;
    }
    return this.#serializeAsCookie(key, packedValue, options);
  }
  /**
   * Encrypts a key-value pair to an encrypted cookie.
   */
  encrypt(key, value, options) {
    const packedValue = this.#client.encrypt(key, value);
    if (packedValue === null) {
      return null;
    }
    return this.#serializeAsCookie(key, packedValue, options);
  }
};

// src/response.ts
var CACHEABLE_HTTP_METHODS = ["GET", "HEAD"];
var Response = class extends Macroable6 {
  constructor(request, response, encryption, config, router, qs) {
    super();
    this.request = request;
    this.response = response;
    this.#qs = qs;
    this.#config = config;
    this.#router = router;
    this.#cookieSerializer = new CookieSerializer(encryption);
  }
  /**
   * Query string parser
   */
  #qs;
  /**
   * Outgoing headers
   */
  #headers = {};
  /**
   * Has explicit status been set
   */
  #hasExplicitStatus = false;
  /**
   * Cookies serializer to serialize the outgoing cookies
   */
  #cookieSerializer;
  /**
   * Router is used to make the redirect URLs from routes
   */
  #router;
  /**
   * Response config
   */
  #config;
  /**
   * Does response has body set that will written to the
   * response socket at the end of the request
   */
  get hasLazyBody() {
    return !!(this.lazyBody.content || this.lazyBody.fileToStream || this.lazyBody.stream);
  }
  /**
   * Find if the response has non-stream content
   */
  get hasContent() {
    return !!this.lazyBody.content;
  }
  /**
   * Returns true when response body is set using "response.stream"
   * method
   */
  get hasStream() {
    return !!this.lazyBody.stream;
  }
  /**
   * Returns true when response body is set using "response.download"
   * or "response.attachment" methods
   */
  get hasFileToStream() {
    return !!this.lazyBody.fileToStream;
  }
  /**
   * Returns the response content. Check if the response
   * has content using the "hasContent" method
   */
  get content() {
    return this.lazyBody.content;
  }
  /**
   * Returns reference to the stream set using "response.stream"
   * method
   */
  get outgoingStream() {
    return this.lazyBody.stream?.[0];
  }
  /**
   * Returns reference to the file path set using "response.stream"
   * method.
   */
  get fileToStream() {
    return this.lazyBody.fileToStream ? {
      path: this.lazyBody.fileToStream[0],
      generateEtag: this.lazyBody.fileToStream[1]
    } : void 0;
  }
  /**
   * Lazy body is used to set the response body. However, do not
   * write it on the socket immediately unless `response.finish`
   * is called.
   */
  lazyBody = {};
  /**
   * The ctx will be set by the context itself. It creates a circular
   * reference
   */
  ctx;
  /**
   * Returns a boolean telling if response is finished or not.
   * Any more attempts to update headers or body will result
   * in raised exceptions.
   */
  get finished() {
    return this.response.writableFinished;
  }
  /**
   * Returns a boolean telling if response headers has been sent or not.
   * Any more attempts to update headers will result in raised
   * exceptions.
   */
  get headersSent() {
    return this.response.headersSent;
  }
  /**
   * Returns a boolean telling if response headers and body is written
   * or not. When value is `true`, you can feel free to write headers
   * and body.
   */
  get isPending() {
    return !this.headersSent && !this.finished;
  }
  /**
   * Normalizes header value to a string or an array of string
   */
  #castHeaderValue(value) {
    return Array.isArray(value) ? value.map(String) : String(value);
  }
  /**
   * Ends the response by flushing headers and writing body
   */
  #endResponse(body, statusCode) {
    this.writeHead(statusCode);
    const res = this.response;
    res.end(body, null, null);
  }
  /**
   * Returns type for the content body. Only following types are allowed
   *
   * - Dates
   * - Arrays
   * - Booleans
   * - Objects
   * - Strings
   * - Buffer
   */
  #getDataType(content) {
    if (content instanceof Uint8Array) {
      return "buffer";
    }
    if (content instanceof Date) {
      return "date";
    }
    if (content instanceof RegExp) {
      return "regexp";
    }
    const dataType = typeof content;
    if (dataType === "number" || dataType === "boolean" || dataType === "string" || dataType === "bigint") {
      return dataType;
    }
    if (dataType === "object") {
      return "object";
    }
    throw new RuntimeException3(`Cannot serialize "${dataType}" to HTTP response`);
  }
  /**
   * Writes the body with appropriate response headers. Etag header is set
   * when `generateEtag` is set to `true`.
   *
   * Empty body results in `204`.
   */
  writeBody(content, generateEtag, jsonpCallbackName) {
    const hasEmptyBody = content === null || content === void 0 || content === "";
    if (hasEmptyBody) {
      this.safeStatus(204);
    }
    const statusCode = this.response.statusCode;
    if (statusCode && (statusCode < ResponseStatus.Ok || statusCode === ResponseStatus.NoContent || statusCode === ResponseStatus.NotModified)) {
      this.removeHeader("Content-Type");
      this.removeHeader("Content-Length");
      this.removeHeader("Transfer-Encoding");
      this.#endResponse();
      return;
    }
    if (hasEmptyBody) {
      this.removeHeader("Content-Length");
      this.#endResponse();
      return;
    }
    const dataType = this.#getDataType(content);
    if (dataType === "object") {
      content = json.safeStringify(content);
    } else if (dataType === "number" || dataType === "boolean" || dataType === "bigint" || dataType === "regexp") {
      content = String(content);
    } else if (dataType === "date") {
      content = content.toISOString();
    }
    if (jsonpCallbackName) {
      content = content.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      content = `/**/ typeof ${jsonpCallbackName} === 'function' && ${jsonpCallbackName}(${content});`;
    }
    if (generateEtag) {
      this.setEtag(content);
    }
    if (generateEtag && this.fresh()) {
      this.removeHeader("Content-Type");
      this.removeHeader("Content-Length");
      this.removeHeader("Transfer-Encoding");
      this.#endResponse(null, ResponseStatus.NotModified);
      return;
    }
    this.setRequestId();
    this.header("Content-Length", Buffer2.byteLength(content));
    if (jsonpCallbackName) {
      this.header("X-Content-Type-Options", "nosniff");
      this.safeHeader("Content-Type", "text/javascript; charset=utf-8");
    } else {
      switch (dataType) {
        case "string":
          const type = /^\s*</.test(content) ? "text/html" : "text/plain";
          this.safeHeader("Content-Type", `${type}; charset=utf-8`);
          break;
        case "number":
        case "boolean":
        case "date":
        case "bigint":
        case "regexp":
          this.safeHeader("Content-Type", "text/plain; charset=utf-8");
          break;
        case "buffer":
          this.safeHeader("Content-Type", "application/octet-stream; charset=utf-8");
          break;
        case "object":
          this.safeHeader("Content-Type", "application/json; charset=utf-8");
          break;
      }
    }
    this.#endResponse(content);
  }
  /**
   * Stream the body to the response and handles cleaning up the stream
   */
  streamBody(body, errorCallback) {
    return new Promise((resolve) => {
      let finished = false;
      body.on("error", (error) => {
        if (finished) {
          return;
        }
        finished = true;
        destroy(body);
        this.type("text");
        if (!this.headersSent) {
          if (typeof errorCallback === "function") {
            this.#endResponse(...errorCallback(error));
          } else {
            this.#endResponse(
              error.code === "ENOENT" ? "File not found" : "Cannot process file",
              error.code === "ENOENT" ? ResponseStatus.NotFound : ResponseStatus.InternalServerError
            );
          }
        } else {
          this.response.destroy();
        }
        resolve();
      });
      body.on("end", () => {
        if (!this.headersSent) {
          this.#endResponse();
        }
        resolve();
      });
      onFinished(this.response, () => {
        finished = true;
        destroy(body);
      });
      this.relayHeaders();
      body.pipe(this.response);
    });
  }
  /**
   * Downloads a file by streaming it to the response
   */
  async streamFileForDownload(filePath, generateEtag, errorCallback) {
    try {
      const stats = await stat(filePath);
      if (!stats || !stats.isFile()) {
        throw new TypeError("response.download only accepts path to a file");
      }
      this.header("Last-Modified", stats.mtime.toUTCString());
      this.type(extname(filePath));
      if (generateEtag) {
        this.setEtag(stats, true);
      }
      if (this.request.method === "HEAD") {
        this.#endResponse(
          null,
          generateEtag && this.fresh() ? ResponseStatus.NotModified : ResponseStatus.Ok
        );
        return;
      }
      if (generateEtag && this.fresh()) {
        this.#endResponse(null, ResponseStatus.NotModified);
        return;
      }
      this.header("Content-length", stats.size);
      return this.streamBody(createReadStream(filePath), errorCallback);
    } catch (error) {
      this.type("text");
      this.removeHeader("Etag");
      if (typeof errorCallback === "function") {
        this.#endResponse(...errorCallback(error));
      } else {
        this.#endResponse(
          error.code === "ENOENT" ? "File not found" : "Cannot process file",
          error.code === "ENOENT" ? ResponseStatus.NotFound : ResponseStatus.InternalServerError
        );
      }
    }
  }
  /**
   * Listen for the event the response is written
   * to the TCP socket.
   *
   * Under the hood the callback is registered with
   * the "https://github.com/jshttp/on-finished" package
   */
  onFinish(callback) {
    onFinished(this.response, callback);
  }
  /**
   * Writes headers with the Node.js res object using the
   * response.setHeader method
   */
  relayHeaders() {
    if (!this.headersSent) {
      for (let key in this.#headers) {
        const value = this.#headers[key];
        if (value) {
          this.response.setHeader(key, value);
        }
      }
    }
  }
  /**
   * Calls res.writeHead on the Node.js res object.
   */
  writeHead(statusCode) {
    this.response.writeHead(statusCode || this.response.statusCode, this.#headers);
    return this;
  }
  /**
   * Returns the existing value for a given HTTP response
   * header.
   */
  getHeader(key) {
    const value = this.#headers[key.toLowerCase()];
    return value === void 0 ? this.response.getHeader(key) : value;
  }
  /**
   * Get response headers
   */
  getHeaders() {
    return {
      ...this.response.getHeaders(),
      ...this.#headers
    };
  }
  /**
   * Set header on the response. To `append` values to the existing header, we suggest
   * using [[append]] method.
   *
   * If `value` is non existy, then header won't be set.
   *
   * @example
   * ```js
   * response.header('content-type', 'application/json')
   * ```
   */
  header(key, value) {
    if (value === null || value === void 0) {
      return this;
    }
    this.#headers[key.toLowerCase()] = this.#castHeaderValue(value);
    return this;
  }
  /**
   * Append value to an existing header. To replace the value, we suggest using
   * [[header]] method.
   *
   * If `value` is not existy, then header won't be set.
   *
   * @example
   * ```js
   * response.append('set-cookie', 'username=virk')
   * ```
   */
  append(key, value) {
    if (value === null || value === void 0) {
      return this;
    }
    key = key.toLowerCase();
    let existingHeader = this.getHeader(key);
    let casted = this.#castHeaderValue(value);
    if (!existingHeader) {
      this.#headers[key] = casted;
      return this;
    }
    existingHeader = this.#castHeaderValue(existingHeader);
    casted = Array.isArray(existingHeader) ? existingHeader.concat(casted) : [existingHeader].concat(casted);
    this.#headers[key] = casted;
    return this;
  }
  /**
   * Adds HTTP response header, when it doesn't exists already.
   */
  safeHeader(key, value) {
    if (!this.getHeader(key)) {
      this.header(key, value);
    }
    return this;
  }
  /**
   * Removes the existing response header from being sent.
   */
  removeHeader(key) {
    key = key.toLowerCase();
    this.response.removeHeader(key);
    if (this.#headers[key]) {
      delete this.#headers[key.toLowerCase()];
    }
    return this;
  }
  /**
   * Returns the status code for the response
   */
  getStatus() {
    return this.response.statusCode;
  }
  /**
   * Set HTTP status code
   */
  status(code) {
    this.#hasExplicitStatus = true;
    this.response.statusCode = code;
    return this;
  }
  /**
   * Set's status code only when it's not explictly
   * set
   */
  safeStatus(code) {
    if (this.#hasExplicitStatus) {
      return this;
    }
    this.response.statusCode = code;
    return this;
  }
  /**
   * Set response type by looking up for the mime-type using
   * partial types like file extensions.
   *
   * Make sure to read [mime-types](https://www.npmjs.com/package/mime-types) docs
   * too.
   *
   * @example
   * ```js
   * response.type('.json') // Content-type: application/json
   * ```
   */
  type(type, charset) {
    type = charset ? `${type}; charset=${charset}` : type;
    this.header("Content-Type", mime.contentType(type));
    return this;
  }
  /**
   * Set the Vary HTTP header
   */
  vary(field) {
    vary(this.response, field);
    return this;
  }
  /**
   * Set etag by computing hash from the body. This class will set the etag automatically
   * when `etag = true` in the defined config object.
   *
   * Use this function, when you want to compute etag manually for some other resons.
   */
  setEtag(body, weak = false) {
    this.header("Etag", etag(body, { weak }));
    return this;
  }
  /**
   * Set X-Request-Id header by copying the header value from the request if it exists.
   *
   */
  setRequestId() {
    const requestId = this.request.headers["x-request-id"];
    if (requestId) {
      this.header("X-Request-Id", requestId);
    }
    return this;
  }
  /**
   * Returns a boolean telling if the new response etag evaluates same
   * as the request header `if-none-match`. In case of `true`, the
   * server must return `304` response, telling the browser to
   * use the client cache.
   *
   * You won't have to deal with this method directly, since AdonisJs will
   * handle this for you when `http.etag = true` inside `config/app.js` file.
   *
   * However, this is how you can use it manually.
   *
   * @example
   * ```js
   * const responseBody = view.render('some-view')
   *
   * // sets the HTTP etag header for response
   * response.setEtag(responseBody)
   *
   * if (response.fresh()) {
   *   response.sendStatus(304)
   * } else {
   *   response.send(responseBody)
   * }
   * ```
   */
  fresh() {
    if (this.request.method && !CACHEABLE_HTTP_METHODS.includes(this.request.method)) {
      return false;
    }
    const status = this.response.statusCode;
    if (status >= ResponseStatus.Ok && status < ResponseStatus.MultipleChoices || status === ResponseStatus.NotModified) {
      return fresh2(this.request.headers, this.#headers);
    }
    return false;
  }
  /**
   * Returns the response body. Returns null when response
   * body is a stream
   */
  getBody() {
    if (this.lazyBody.content) {
      return this.lazyBody.content[0];
    }
    return null;
  }
  /**
   * Send the body as response and optionally generate etag. The default value
   * is read from `config/app.js` file, using `http.etag` property.
   *
   * This method buffers the body if `explicitEnd = true`, which is the default
   * behavior and do not change, unless you know what you are doing.
   */
  send(body, generateEtag = this.#config.etag) {
    this.lazyBody.content = [body, generateEtag];
  }
  /**
   * Alias of [[send]]
   */
  json(body, generateEtag = this.#config.etag) {
    return this.send(body, generateEtag);
  }
  /**
   * Writes response as JSONP. The callback name is resolved as follows, with priority
   * from top to bottom.
   *
   * 1. Explicitly defined as 2nd Param.
   * 2. Fetch from request query string.
   * 3. Use the config value `http.jsonpCallbackName` from `config/app.js`.
   * 4. Fallback to `callback`.
   *
   * This method buffers the body if `explicitEnd = true`, which is the default
   * behavior and do not change, unless you know what you are doing.
   */
  jsonp(body, callbackName = this.#config.jsonpCallbackName, generateEtag = this.#config.etag) {
    this.lazyBody.content = [body, generateEtag, callbackName];
  }
  /**
   * Pipe stream to the response. This method will gracefully destroy
   * the stream, avoiding memory leaks.
   *
   * If `raiseErrors=false`, then this method will self handle all the exceptions by
   * writing a generic HTTP response. To have more control over the error, it is
   * recommended to set `raiseErrors=true` and wrap this function inside a
   * `try/catch` statement.
   *
   * Streaming a file from the disk and showing 404 when file is missing.
   *
   * @example
   * ```js
   * // Errors handled automatically with generic HTTP response
   * response.stream(fs.createReadStream('file.txt'))
   *
   * // Manually handle (note the await call)
   * try {
   *   await response.stream(fs.createReadStream('file.txt'))
   * } catch () {
   *   response.status(404).send('File not found')
   * }
   * ```
   */
  stream(body, errorCallback) {
    if (typeof body.pipe !== "function" || !body.readable || typeof body.read !== "function") {
      throw new TypeError("response.stream accepts a readable stream only");
    }
    this.lazyBody.stream = [body, errorCallback];
  }
  /**
   * Download file by streaming it from the file path. This method will setup
   * appropriate `Content-type`, `Content-type` and `Last-modified` headers.
   *
   * Unexpected stream errors are handled gracefully to avoid memory leaks.
   *
   * If `raiseErrors=false`, then this method will self handle all the exceptions by
   * writing a generic HTTP response. To have more control over the error, it is
   * recommended to set `raiseErrors=true` and wrap this function inside a
   * `try/catch` statement.
   *
   * @example
   * ```js
   * // Errors handled automatically with generic HTTP response
   * response.download('somefile.jpg')
   *
   * // Manually handle (note the await call)
   * try {
   *   await response.download('somefile.jpg')
   * } catch (error) {
   *   response.status(error.code === 'ENOENT' ? 404 : 500)
   *   response.send('Cannot process file')
   * }
   * ```
   */
  download(filePath, generateEtag = this.#config.etag, errorCallback) {
    this.lazyBody.fileToStream = [filePath, generateEtag, errorCallback];
  }
  /**
   * Download the file by forcing the user to save the file vs displaying it
   * within the browser.
   *
   * Internally calls [[download]]
   */
  attachment(filePath, name, disposition, generateEtag, errorCallback) {
    name = name || filePath;
    this.header("Content-Disposition", contentDisposition(name, { type: disposition }));
    return this.download(filePath, generateEtag, errorCallback);
  }
  /**
   * Set the location header.
   *
   * @example
   * ```js
   * response.location('/login')
   * ```
   */
  location(url) {
    this.header("Location", url);
    return this;
  }
  redirect(path, forwardQueryString = false, statusCode = ResponseStatus.Found) {
    const handler = new Redirect(this.request, this, this.#router, this.#qs);
    if (forwardQueryString) {
      handler.withQs();
    }
    if (path === "back") {
      return handler.status(statusCode).back();
    }
    if (path) {
      return handler.status(statusCode).toPath(path);
    }
    return handler;
  }
  /**
   * Abort the request with custom body and a status code. 400 is
   * used when status is not defined
   */
  abort(body, status) {
    throw E_HTTP_REQUEST_ABORTED.invoke(body, status || ResponseStatus.BadRequest);
  }
  /**
   * Abort the request with custom body and a status code when
   * passed condition returns `true`
   */
  abortIf(condition, body, status) {
    if (condition) {
      this.abort(body, status);
    }
  }
  /**
   * Abort the request with custom body and a status code when
   * passed condition returns `false`
   */
  abortUnless(condition, body, status) {
    if (!condition) {
      this.abort(body, status);
    }
  }
  /**
   * Set signed cookie as the response header. The inline options overrides
   * all options from the config.
   */
  cookie(key, value, options) {
    options = Object.assign({}, this.#config.cookie, options);
    const serialized = this.#cookieSerializer.sign(key, value, options);
    if (!serialized) {
      return this;
    }
    this.append("set-cookie", serialized);
    return this;
  }
  /**
   * Set encrypted cookie as the response header. The inline options overrides
   * all options from the config.
   */
  encryptedCookie(key, value, options) {
    options = Object.assign({}, this.#config.cookie, options);
    const serialized = this.#cookieSerializer.encrypt(key, value, options);
    if (!serialized) {
      return this;
    }
    this.append("set-cookie", serialized);
    return this;
  }
  /**
   * Set unsigned cookie as the response header. The inline options overrides
   * all options from the config.
   */
  plainCookie(key, value, options) {
    options = Object.assign({}, this.#config.cookie, options);
    const serialized = this.#cookieSerializer.encode(key, value, options);
    if (!serialized) {
      return this;
    }
    this.append("set-cookie", serialized);
    return this;
  }
  /**
   * Clear existing cookie.
   */
  clearCookie(key, options) {
    options = Object.assign({}, this.#config.cookie, options);
    options.expires = /* @__PURE__ */ new Date(1);
    options.maxAge = -1;
    const serialized = this.#cookieSerializer.encode(key, "", { ...options, encode: false });
    this.append("set-cookie", serialized);
    return this;
  }
  /**
   * Finishes the response by writing the lazy body, when `explicitEnd = true`
   * and response is already pending.
   *
   * Calling this method twice or when `explicitEnd = false` is noop.
   */
  finish() {
    if (!this.isPending) {
      return;
    }
    if (this.content) {
      this.writeBody(...this.content);
      return;
    }
    if (this.lazyBody.stream) {
      this.streamBody(...this.lazyBody.stream);
      return;
    }
    if (this.lazyBody.fileToStream) {
      this.streamFileForDownload(...this.lazyBody.fileToStream);
      return;
    }
    this.#endResponse();
  }
  /**
   * Shorthand method to finish request with "100" status code
   */
  continue() {
    this.status(ResponseStatus.Continue);
    return this.send(null, false);
  }
  /**
   * Shorthand method to finish request with "101" status code
   */
  switchingProtocols() {
    this.status(ResponseStatus.SwitchingProtocols);
    return this.send(null, false);
  }
  /**
   * Shorthand method to finish request with "200" status code
   */
  ok(body, generateEtag) {
    this.status(ResponseStatus.Ok);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "201" status code
   */
  created(body, generateEtag) {
    this.status(ResponseStatus.Created);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "202" status code
   */
  accepted(body, generateEtag) {
    this.status(ResponseStatus.Accepted);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "203" status code
   */
  nonAuthoritativeInformation(body, generateEtag) {
    this.status(ResponseStatus.NonAuthoritativeInformation);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "204" status code
   */
  noContent() {
    this.status(ResponseStatus.NoContent);
    return this.send(null, false);
  }
  /**
   * Shorthand method to finish request with "205" status code
   */
  resetContent() {
    this.status(ResponseStatus.ResetContent);
    return this.send(null, false);
  }
  /**
   * Shorthand method to finish request with "206" status code
   */
  partialContent(body, generateEtag) {
    this.status(ResponseStatus.PartialContent);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "300" status code
   */
  multipleChoices(body, generateEtag) {
    this.status(ResponseStatus.MultipleChoices);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "301" status code
   */
  movedPermanently(body, generateEtag) {
    this.status(ResponseStatus.MovedPermanently);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "302" status code
   */
  movedTemporarily(body, generateEtag) {
    this.status(ResponseStatus.Found);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "303" status code
   */
  seeOther(body, generateEtag) {
    this.status(ResponseStatus.SeeOther);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "304" status code
   */
  notModified(body, generateEtag) {
    this.status(ResponseStatus.NotModified);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "305" status code
   */
  useProxy(body, generateEtag) {
    this.status(ResponseStatus.UseProxy);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "307" status code
   */
  temporaryRedirect(body, generateEtag) {
    this.status(ResponseStatus.TemporaryRedirect);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "400" status code
   */
  badRequest(body, generateEtag) {
    this.status(ResponseStatus.BadRequest);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "401" status code
   */
  unauthorized(body, generateEtag) {
    this.status(ResponseStatus.Unauthorized);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "402" status code
   */
  paymentRequired(body, generateEtag) {
    this.status(ResponseStatus.PaymentRequired);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "403" status code
   */
  forbidden(body, generateEtag) {
    this.status(ResponseStatus.Forbidden);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "404" status code
   */
  notFound(body, generateEtag) {
    this.status(ResponseStatus.NotFound);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "405" status code
   */
  methodNotAllowed(body, generateEtag) {
    this.status(ResponseStatus.MethodNotAllowed);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "406" status code
   */
  notAcceptable(body, generateEtag) {
    this.status(ResponseStatus.NotAcceptable);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "407" status code
   */
  proxyAuthenticationRequired(body, generateEtag) {
    this.status(ResponseStatus.ProxyAuthenticationRequired);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "408" status code
   */
  requestTimeout(body, generateEtag) {
    this.status(ResponseStatus.RequestTimeout);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "409" status code
   */
  conflict(body, generateEtag) {
    this.status(ResponseStatus.Conflict);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "401" status code
   */
  gone(body, generateEtag) {
    this.status(ResponseStatus.Gone);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "411" status code
   */
  lengthRequired(body, generateEtag) {
    this.status(ResponseStatus.LengthRequired);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "412" status code
   */
  preconditionFailed(body, generateEtag) {
    this.status(ResponseStatus.PreconditionFailed);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "413" status code
   */
  requestEntityTooLarge(body, generateEtag) {
    this.status(ResponseStatus.PayloadTooLarge);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "414" status code
   */
  requestUriTooLong(body, generateEtag) {
    this.status(ResponseStatus.URITooLong);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "415" status code
   */
  unsupportedMediaType(body, generateEtag) {
    this.status(ResponseStatus.UnsupportedMediaType);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "416" status code
   */
  requestedRangeNotSatisfiable(body, generateEtag) {
    this.status(ResponseStatus.RangeNotSatisfiable);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "417" status code
   */
  expectationFailed(body, generateEtag) {
    this.status(ResponseStatus.ExpectationFailed);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "422" status code
   */
  unprocessableEntity(body, generateEtag) {
    this.status(ResponseStatus.UnprocessableEntity);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "429" status code
   */
  tooManyRequests(body, generateEtag) {
    this.status(ResponseStatus.TooManyRequests);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "500" status code
   */
  internalServerError(body, generateEtag) {
    this.status(ResponseStatus.InternalServerError);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "501" status code
   */
  notImplemented(body, generateEtag) {
    this.status(ResponseStatus.NotImplemented);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "502" status code
   */
  badGateway(body, generateEtag) {
    this.status(ResponseStatus.BadGateway);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "503" status code
   */
  serviceUnavailable(body, generateEtag) {
    this.status(ResponseStatus.ServiceUnavailable);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "504" status code
   */
  gatewayTimeout(body, generateEtag) {
    this.status(ResponseStatus.GatewayTimeout);
    return this.send(body, generateEtag);
  }
  /**
   * Shorthand method to finish request with "505" status code
   */
  httpVersionNotSupported(body, generateEtag) {
    this.status(ResponseStatus.HTTPVersionNotSupported);
    return this.send(body, generateEtag);
  }
};

// src/router/main.ts
import is3 from "@sindresorhus/is";
import { moduleImporter as moduleImporter3 } from "@adonisjs/fold";
import { RuntimeException as RuntimeException6 } from "@poppinss/utils";

// src/router/store.ts
import matchit2 from "@poppinss/matchit";
import lodash2 from "@poppinss/utils/lodash";
import { RuntimeException as RuntimeException4 } from "@poppinss/utils";

// src/router/parser.ts
import matchit from "@poppinss/matchit";
function parseRoutePattern(pattern, matchers) {
  const tokens = matchit.parse(pattern, matchers);
  return tokens;
}

// src/router/store.ts
var RoutesStore = class {
  /**
   * A flag to know if routes for explicit domains
   * have been registered
   */
  usingDomains = false;
  /**
   * Tree of registered routes and their matchit tokens
   */
  tree = { tokens: [], domains: {} };
  /**
   * Returns the domain node for a given domain.
   */
  #getDomainNode(domain) {
    if (!this.tree.domains[domain]) {
      this.tree.tokens.push(parseRoutePattern(domain));
      this.tree.domains[domain] = {};
    }
    return this.tree.domains[domain];
  }
  /**
   * Returns the method node for a given domain and method.
   */
  #getMethodNode(domain, method) {
    const domainNode = this.#getDomainNode(domain);
    if (!domainNode[method]) {
      domainNode[method] = { tokens: [], routes: {}, routeKeys: {} };
    }
    return domainNode[method];
  }
  /**
   * Collects route params
   */
  #collectRouteParams(route, tokens) {
    const collectedParams = /* @__PURE__ */ new Set();
    for (let token of tokens) {
      if ([1, 3].includes(token.type)) {
        if (collectedParams.has(token.val)) {
          throw new RuntimeException4(`Duplicate param "${token.val}" found in "${route.pattern}"`);
        } else {
          collectedParams.add(token.val);
        }
      }
    }
    const params = [...collectedParams];
    collectedParams.clear();
    return params;
  }
  /**
   * Register route for a given domain and method
   */
  #registerRoute(domain, method, tokens, route) {
    const methodRoutes = this.#getMethodNode(domain, method);
    if (methodRoutes.routes[route.pattern]) {
      throw new RuntimeException4(
        `Duplicate route found. "${method}: ${route.pattern}" route already exists`
      );
    }
    if (debug_default.enabled) {
      debug_default("registering route to the store %O", route);
      debug_default("route middleware %O", route.middleware.all().entries());
    }
    methodRoutes.tokens.push(tokens);
    methodRoutes.routes[route.pattern] = route;
    methodRoutes.routeKeys[route.pattern] = domain !== "root" ? `${domain}-${method}-${route.pattern}` : `${method}-${route.pattern}`;
  }
  /**
   * Add a route to the store
   *
   * ```ts
   * store.add({
   *   pattern: 'post/:id',
   *   methods: ['GET'],
   *   matchers: {},
   *   meta: {},
   *   handler: function handler () {
   *   }
   * })
   * ```
   */
  add(route) {
    if (route.domain !== "root") {
      this.usingDomains = true;
    }
    const tokens = parseRoutePattern(route.pattern, route.matchers);
    const routeNode = lodash2.merge(
      { meta: {} },
      lodash2.pick(route, ["pattern", "handler", "meta", "middleware", "name", "execute"])
    );
    routeNode.meta.params = this.#collectRouteParams(routeNode, tokens);
    route.methods.forEach((method) => {
      this.#registerRoute(route.domain, method, tokens, routeNode);
    });
    return this;
  }
  /**
   * Matches the url, method and optionally domain to pull the matching
   * route. `null` is returned when unable to match the URL against
   * registered routes.
   *
   * The domain parameter has to be a registered pattern and not the fully
   * qualified runtime domain. You must call `matchDomain` first to fetch
   * the pattern for qualified domain
   */
  match(url, method, domain) {
    const domainName = domain?.tokens[0]?.old || "root";
    const matchedDomain = this.tree.domains[domainName];
    if (!matchedDomain) {
      return null;
    }
    const matchedMethod = this.tree.domains[domainName][method];
    if (!matchedMethod) {
      return null;
    }
    const matchedRoute = matchit2.match(url, matchedMethod.tokens);
    if (!matchedRoute.length) {
      return null;
    }
    const route = matchedMethod.routes[matchedRoute[0].old];
    return {
      route,
      routeKey: matchedMethod.routeKeys[route.pattern],
      params: matchit2.exec(url, matchedRoute),
      subdomains: domain?.hostname ? matchit2.exec(domain.hostname, domain.tokens) : {}
    };
  }
  /**
   * Match hostname against registered domains.
   */
  matchDomain(hostname) {
    if (!hostname || !this.usingDomains) {
      return [];
    }
    return matchit2.match(hostname, this.tree.tokens);
  }
};

// src/router/lookup_store/main.ts
import Macroable7 from "@poppinss/macroable";

// src/router/lookup_store/url_builder.ts
import { RuntimeException as RuntimeException5 } from "@poppinss/utils";
var UrlBuilder = class {
  /**
   * Query string parser
   */
  #qsParser;
  /**
   * The parameters to apply on the route
   */
  #params = {};
  /**
   * Query string to append to the route
   */
  #qs = {};
  /**
   * Should we perform the route lookup or just build the
   * given pattern as it is.
   */
  #shouldPerformLookup = true;
  /**
   * BaseURL to append to the constructored URL
   */
  #baseUrl;
  /**
   * Encryption class for making signed URLs
   */
  #encryption;
  /**
   * Route finder for finding route pattern
   */
  #routeFinder;
  constructor(encryption, routeFinder, qsParser) {
    this.#qsParser = qsParser;
    this.#encryption = encryption;
    this.#routeFinder = routeFinder;
  }
  /**
   * Raises exception when wildcard values array is missing or
   * has length of zero.
   */
  #ensureHasWildCardValues(pattern, values) {
    if (!values || !Array.isArray(values) || !values.length) {
      throw new RuntimeException5(
        `Cannot make URL for "${pattern}" route. Invalid value provided for wildcard param`
      );
    }
  }
  /*
   * Raises exception when value is not defined
   */
  #ensureHasParamValue(pattern, param, value) {
    if (value === void 0 || value === null) {
      throw new RuntimeException5(
        `Cannot make URL for "${pattern}" route. Missing value for "${param}" param`
      );
    }
  }
  /**
   * Processes the pattern against the params
   */
  #processPattern(pattern) {
    const uriSegments = [];
    const paramsArray = Array.isArray(this.#params) ? this.#params : null;
    const paramsObject = !Array.isArray(this.#params) ? this.#params : {};
    let paramsIndex = 0;
    const tokens = parseRoutePattern(pattern);
    for (const token of tokens) {
      if (token.type === 0) {
        uriSegments.push(token.val === "/" ? "" : `${token.val}${token.end}`);
      } else if (token.type === 2) {
        const values = paramsArray ? paramsArray.slice(paramsIndex) : paramsObject["*"];
        this.#ensureHasWildCardValues(pattern, values);
        uriSegments.push(`${values.join("/")}${token.end}`);
        break;
      } else {
        const paramName = token.val;
        const value = paramsArray ? paramsArray[paramsIndex] : paramsObject[paramName];
        if (token.type === 1) {
          this.#ensureHasParamValue(pattern, paramName, value);
        }
        paramsIndex++;
        if (value !== void 0 && value !== null) {
          uriSegments.push(`${value}${token.end}`);
        }
      }
    }
    return `/${uriSegments.join("/")}`;
  }
  /**
   * Suffix the query string to the URL
   */
  #suffixQueryString(url, qs) {
    if (qs) {
      const queryString = this.#qsParser.stringify(qs);
      url = queryString ? `${url}?${queryString}` : url;
    }
    return url;
  }
  /**
   * Prefixes base URL to the uri string
   */
  #prefixBaseUrl(uri) {
    return this.#baseUrl ? `${this.#baseUrl}${uri}` : uri;
  }
  /**
   * Prefix a custom base URL to the final URI
   */
  prefixUrl(url) {
    this.#baseUrl = url;
    return this;
  }
  /**
   * Disable route lookup. Calling this method considers
   * the "identifier" as the route pattern
   */
  disableRouteLookup() {
    this.#shouldPerformLookup = false;
    return this;
  }
  /**
   * Append query string to the final URI
   */
  qs(queryString) {
    if (!queryString) {
      return this;
    }
    this.#qs = queryString;
    return this;
  }
  /**
   * Specify params to apply to the route pattern
   */
  params(params) {
    if (!params) {
      return this;
    }
    this.#params = params;
    return this;
  }
  /**
   * Generate URL for the given route identifier. The identifier can be the
   * route name, controller.method name or the route pattern
   * itself.
   */
  make(identifier) {
    let url;
    if (this.#shouldPerformLookup) {
      const route = this.#routeFinder.findOrFail(identifier);
      url = this.#processPattern(route.pattern);
    } else {
      url = this.#processPattern(identifier);
    }
    return this.#suffixQueryString(this.#prefixBaseUrl(url), this.#qs);
  }
  /**
   * Generate a signed URL for the given route identifier. The identifier can be the
   * route name, controller.method name or the route pattern
   * itself.
   */
  makeSigned(identifier, options) {
    let url;
    if (this.#shouldPerformLookup) {
      const route = this.#routeFinder.findOrFail(identifier);
      url = this.#processPattern(route.pattern);
    } else {
      url = this.#processPattern(identifier);
    }
    const signature = this.#encryption.verifier.sign(
      this.#suffixQueryString(url, this.#qs),
      options?.expiresIn,
      options?.purpose
    );
    const qs = Object.assign({}, this.#qs, { signature });
    return this.#suffixQueryString(this.#prefixBaseUrl(url), qs);
  }
};

// src/router/lookup_store/route_finder.ts
var RouteFinder = class {
  #routes = [];
  register(route) {
    this.#routes.push(route);
  }
  /**
   * Find a route by indentifier
   */
  find(routeIdentifier) {
    return this.#routes.find(({ name, pattern, handler }) => {
      if (name === routeIdentifier || pattern === routeIdentifier) {
        return true;
      }
      if (typeof handler === "function") {
        return false;
      }
      return handler.reference === routeIdentifier;
    }) || null;
  }
  /**
   * Find a route by indentifier or fail
   */
  findOrFail(routeIdentifier) {
    const route = this.find(routeIdentifier);
    if (!route) {
      throw new E_CANNOT_LOOKUP_ROUTE([routeIdentifier]);
    }
    return route;
  }
  /**
   * Find if a route exists
   */
  has(routeIdentifier) {
    return !!this.find(routeIdentifier);
  }
  /**
   * Returns an array of registered routes
   */
  toJSON() {
    return this.#routes;
  }
};

// src/router/lookup_store/main.ts
var LookupStore = class extends Macroable7 {
  /**
   * List of route finders grouped by domains
   */
  #routes = {};
  /**
   * Encryption for making URLs
   */
  #encryption;
  /**
   * Query string parser for making URLs
   */
  #qsParser;
  constructor(encryption, qsParser) {
    super();
    this.#encryption = encryption;
    this.#qsParser = qsParser;
  }
  /**
   * Register route JSON payload
   */
  register(route) {
    this.#routes[route.domain] = this.#routes[route.domain] || new RouteFinder();
    this.#routes[route.domain].register(route);
  }
  /**
   * Returns an instance of the URL builder for making
   * route URIs
   */
  builder() {
    return this.builderForDomain("root");
  }
  /**
   * Returns an instance of the URL builder for a specific
   * domain.
   */
  builderForDomain(domain) {
    const finder = this.#routes[domain];
    return new UrlBuilder(this.#encryption, finder || new RouteFinder(), this.#qsParser);
  }
  /**
   * Finds a route by its identifier. The identifier can be the
   * route name, controller.method name or the route pattern
   * itself.
   */
  find(routeIdentifier, domain) {
    const finder = this.#routes[domain || "root"];
    if (!finder) {
      return null;
    }
    return finder.find(routeIdentifier);
  }
  /**
   * Finds a route by its identifier. The identifier can be the
   * route name, controller.method name or the route pattern
   * itself.
   *
   * An error is raised when unable to find the route.
   */
  findOrFail(routeIdentifier, domain) {
    const finder = this.#routes[domain || "root"];
    if (!finder) {
      throw new E_CANNOT_LOOKUP_ROUTE([routeIdentifier]);
    }
    return finder.findOrFail(routeIdentifier);
  }
  /**
   * Check if a route exists. The identifier can be the
   * route name, controller.method name or the route pattern
   * itself.
   */
  has(routeIdentifier, domain) {
    const finder = this.#routes[domain || "root"];
    if (!finder) {
      return false;
    }
    return finder.has(routeIdentifier);
  }
  toJSON() {
    return Object.keys(this.#routes).reduce((result, domain) => {
      result[domain] = this.#routes[domain].toJSON();
      return result;
    }, {});
  }
};

// src/router/matchers.ts
import Macroable8 from "@poppinss/macroable";
var RouteMatchers = class extends Macroable8 {
  /**
   * Enforce value to be a number and also casts it to number data
   * type
   */
  number() {
    return { match: /^[0-9]+$/, cast: (value) => Number(value) };
  }
  /**
   * Enforce value to be formatted as uuid
   */
  uuid() {
    return {
      match: /^[0-9a-zA-F]{8}-[0-9a-zA-F]{4}-[0-9a-zA-F]{4}-[0-9a-zA-F]{4}-[0-9a-zA-F]{12}$/,
      cast: (value) => value.toLowerCase()
    };
  }
  /**
   * Enforce value to be formatted as slug
   */
  slug() {
    return { match: /^[^\s-_](?!.*?[-_]{2,})([a-z0-9-\\]{1,})[^\s]*[^-_\s]$/ };
  }
};

// src/define_middleware.ts
import { moduleImporter as moduleImporter2 } from "@adonisjs/fold";
function middlewareReferenceBuilder(name, middleware) {
  const handler = moduleImporter2(middleware, "handle").toHandleMethod();
  return function(...args) {
    return {
      ...handler,
      name,
      args: args[0]
    };
  };
}
function defineNamedMiddleware(collection) {
  return Object.keys(collection).reduce(
    (result, key) => {
      result[key] = middlewareReferenceBuilder(key, collection[key]);
      return result;
    },
    {}
  );
}

// src/router/main.ts
var Router = class extends LookupStore {
  #commited = false;
  /**
   * Application is needed to resolve string based controller expressions
   */
  #app;
  /**
   * Store with tokenized routes
   */
  #store = new RoutesStore();
  /**
   * Global matchers to test route params against regular expressions.
   */
  #globalMatchers = {};
  /**
   * Middleware store to be shared with the routes
   */
  #middleware = [];
  /**
   * A boolean to tell the router that a group is in
   * open state right now
   */
  #openedGroups = [];
  /**
   * Collection of routes, including route resource and route
   * group. To get a flat list of routes, call `router.toJSON()`
   */
  routes = [];
  /**
   * A flag to know if routes for explicit domains have been registered.
   * The boolean is computed after calling the "commit" method.
   */
  usingDomains = false;
  /**
   * Shortcut methods for commonly used route matchers
   */
  matchers = new RouteMatchers();
  /**
   * Check if routes have been committed to the store. Once
   * routes are committed, defining new set of routes will
   * have no impact
   */
  get commited() {
    return this.#commited;
  }
  constructor(app, encryption, qsParser) {
    super(encryption, qsParser);
    this.#app = app;
  }
  /**
   * Push a give router entity to the list of routes or the
   * recently opened group.
   */
  #pushToRoutes(entity) {
    const openedGroup = this.#openedGroups[this.#openedGroups.length - 1];
    if (openedGroup) {
      openedGroup.routes.push(entity);
      return;
    }
    this.routes.push(entity);
  }
  /**
   * Parses the route pattern
   */
  parsePattern(pattern, matchers) {
    return parseRoutePattern(pattern, matchers);
  }
  /**
   * Define an array of middleware to use on all the routes.
   * Calling this method multiple times pushes to the
   * existing list of middleware
   */
  use(middleware) {
    middleware.forEach(
      (one) => this.#middleware.push(moduleImporter3(one, "handle").toHandleMethod())
    );
    return this;
  }
  /**
   * Define a collection of named middleware. The defined collection is
   * not registered anywhere, but instead converted in a new collection
   * of functions you can apply on the routes, or router groups.
   */
  named(collection) {
    return defineNamedMiddleware(collection);
  }
  /**
   * Add route for a given pattern and methods
   */
  route(pattern, methods, handler) {
    const route = new Route(this.#app, this.#middleware, {
      pattern,
      methods,
      handler,
      globalMatchers: this.#globalMatchers
    });
    this.#pushToRoutes(route);
    return route;
  }
  /**
   * Define a route that handles all common HTTP methods
   */
  any(pattern, handler) {
    return this.route(
      pattern,
      ["HEAD", "OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
      handler
    );
  }
  /**
   * Define `GET` route
   */
  get(pattern, handler) {
    return this.route(pattern, ["GET", "HEAD"], handler);
  }
  /**
   * Define `POST` route
   */
  post(pattern, handler) {
    return this.route(pattern, ["POST"], handler);
  }
  /**
   * Define `PUT` route
   */
  put(pattern, handler) {
    return this.route(pattern, ["PUT"], handler);
  }
  /**
   * Define `PATCH` route
   */
  patch(pattern, handler) {
    return this.route(pattern, ["PATCH"], handler);
  }
  /**
   * Define `DELETE` route
   */
  delete(pattern, handler) {
    return this.route(pattern, ["DELETE"], handler);
  }
  /**
   * Creates a group of routes. A route group can apply transforms
   * to routes in bulk
   */
  group(callback) {
    const group = new RouteGroup([]);
    this.#pushToRoutes(group);
    this.#openedGroups.push(group);
    callback();
    this.#openedGroups.pop();
    return group;
  }
  /**
   * Registers a route resource with conventional set of routes
   */
  resource(resource, controller) {
    const resourceInstance = new RouteResource(this.#app, this.#middleware, {
      resource,
      controller,
      shallow: false,
      globalMatchers: this.#globalMatchers
    });
    this.#pushToRoutes(resourceInstance);
    return resourceInstance;
  }
  /**
   * Register a route resource with shallow nested routes.
   */
  shallowResource(resource, controller) {
    const resourceInstance = new RouteResource(this.#app, this.#middleware, {
      resource,
      controller,
      shallow: true,
      globalMatchers: this.#globalMatchers
    });
    this.#pushToRoutes(resourceInstance);
    return resourceInstance;
  }
  /**
   * Returns a brisk route instance for a given URL pattern
   */
  on(pattern) {
    const briskRoute = new BriskRoute(this.#app, this.#middleware, {
      pattern,
      globalMatchers: this.#globalMatchers
    });
    this.#pushToRoutes(briskRoute);
    return briskRoute;
  }
  /**
   * Define matcher for a given param. The global params are applied
   * on all the routes (unless overridden at the route level).
   */
  where(param, matcher) {
    if (typeof matcher === "string") {
      this.#globalMatchers[param] = { match: new RegExp(matcher) };
    } else if (is3.regExp(matcher)) {
      this.#globalMatchers[param] = { match: matcher };
    } else {
      this.#globalMatchers[param] = matcher;
    }
    return this;
  }
  /**
   * Commit routes to the store. The router is freezed after the
   * commit method is called.
   */
  commit() {
    if (this.#commited) {
      return;
    }
    debug_default("Committing routes to the routes store");
    const routeNamesByDomain = /* @__PURE__ */ new Map();
    toRoutesJSON(this.routes).forEach((route) => {
      if (!routeNamesByDomain.has(route.domain)) {
        routeNamesByDomain.set(route.domain, /* @__PURE__ */ new Set());
      }
      const routeNames = routeNamesByDomain.get(route.domain);
      if (route.name && routeNames.has(route.name)) {
        throw new RuntimeException6(
          `Route with duplicate name found. A route with name "${route.name}" already exists`
        );
      }
      if (route.name) {
        routeNames.add(route.name);
      }
      this.register(route);
      this.#store.add(route);
    });
    routeNamesByDomain.clear();
    this.usingDomains = this.#store.usingDomains;
    this.routes = [];
    this.#globalMatchers = {};
    this.#middleware = [];
    this.#commited = true;
  }
  /**
   * Find route for a given URL, method and optionally domain
   */
  match(url, method, hostname) {
    const matchingDomain = this.#store.matchDomain(hostname);
    return matchingDomain.length ? this.#store.match(url, method, {
      tokens: matchingDomain,
      hostname
    }) : this.#store.match(url, method);
  }
  /**
   * Make URL to a pre-registered route
   */
  makeUrl(routeIdentifier, params, options) {
    const normalizedOptions = Object.assign({}, options);
    const builder = normalizedOptions.domain ? this.builderForDomain(normalizedOptions.domain) : this.builder();
    builder.params(params);
    builder.qs(normalizedOptions.qs);
    normalizedOptions.prefixUrl && builder.prefixUrl(normalizedOptions.prefixUrl);
    normalizedOptions.disableRouteLookup && builder.disableRouteLookup();
    return builder.make(routeIdentifier);
  }
  /**
   * Makes a signed URL to a pre-registered route.
   */
  makeSignedUrl(routeIdentifier, params, options) {
    const normalizedOptions = Object.assign({}, options);
    const builder = normalizedOptions.domain ? this.builderForDomain(normalizedOptions.domain) : this.builder();
    builder.params(params);
    builder.qs(normalizedOptions.qs);
    normalizedOptions.prefixUrl && builder.prefixUrl(normalizedOptions.prefixUrl);
    normalizedOptions.disableRouteLookup && builder.disableRouteLookup();
    return builder.makeSigned(routeIdentifier, normalizedOptions);
  }
};

// src/http_context/main.ts
import { inspect } from "util";
import Macroable9 from "@poppinss/macroable";
import { RuntimeException as RuntimeException7 } from "@poppinss/utils";

// src/http_context/local_storage.ts
import { AsyncLocalStorage } from "async_hooks";
var asyncLocalStorage = {
  /**
   * Check if the async local storage for the HTTP
   * context is enabled or not
   */
  isEnabled: false,
  /**
   * HTTP context storage instance for the current scope
   */
  storage: null,
  /**
   * Create the storage instance. This method must be called only
   * once.
   */
  create() {
    this.isEnabled = true;
    this.storage = new AsyncLocalStorage();
    return this.storage;
  },
  /**
   * Destroy the create storage instance
   */
  destroy() {
    this.isEnabled = false;
    this.storage = null;
  }
};

// src/http_context/main.ts
var HttpContext = class extends Macroable9 {
  constructor(request, response, logger, containerResolver) {
    super();
    this.request = request;
    this.response = response;
    this.logger = logger;
    this.containerResolver = containerResolver;
    this.request.ctx = this;
    this.response.ctx = this;
  }
  /**
   * Find if async localstorage is enabled for HTTP requests
   * or not
   */
  static get usingAsyncLocalStorage() {
    return asyncLocalStorage.isEnabled;
  }
  /**
   * Get access to the HTTP context. Available only when
   * "usingAsyncLocalStorage" is true
   */
  static get() {
    if (!this.usingAsyncLocalStorage || !asyncLocalStorage.storage) {
      return null;
    }
    return asyncLocalStorage.storage.getStore() || null;
  }
  /**
   * Get the HttpContext instance or raise an exception if not
   * available
   */
  static getOrFail() {
    if (!this.usingAsyncLocalStorage || !asyncLocalStorage.storage) {
      throw new RuntimeException7(
        'HTTP context is not available. Enable "useAsyncLocalStorage" inside "config/app.ts" file'
      );
    }
    const store = this.get();
    if (!store) {
      throw new RuntimeException7("Http context is not available outside of an HTTP request");
    }
    return store;
  }
  /**
   * Run a method that doesn't have access to HTTP context from
   * the async local storage.
   */
  static runOutsideContext(callback, ...args) {
    if (!asyncLocalStorage.storage) {
      return callback(...args);
    }
    return asyncLocalStorage.storage.exit(callback, ...args);
  }
  /**
   * Reference to the current route. Not available inside
   * server middleware
   */
  route;
  /**
   * A unique key for the current route
   */
  routeKey;
  /**
   * Route params
   */
  params = {};
  /**
   * Route subdomains
   */
  subdomains = {};
  /**
   * A helper to see top level properties on the context object
   */
  /* c8 ignore next 3 */
  inspect() {
    return inspect(this, false, 1, true);
  }
};

// src/server/main.ts
import onFinished2 from "on-finished";
import Middleware2 from "@poppinss/middleware";
import { moduleCaller as moduleCaller2, moduleImporter as moduleImporter4 } from "@adonisjs/fold";

// src/qs.ts
import { parse as parse3, stringify } from "qs";
var Qs = class {
  #config;
  constructor(config) {
    this.#config = config;
  }
  parse(value) {
    return parse3(value, this.#config.parse);
  }
  stringify(value) {
    return stringify(value, this.#config.stringify);
  }
};

// src/server/factories/final_handler.ts
function finalHandler(router, resolver, ctx, errorResponder) {
  return function() {
    const url = ctx.request.url();
    const method = ctx.request.method();
    const hostname = router.usingDomains ? ctx.request.hostname() : void 0;
    const route = router.match(url, method, hostname);
    if (route) {
      ctx.params = route.params;
      ctx.subdomains = route.subdomains;
      ctx.route = route.route;
      ctx.routeKey = route.routeKey;
      return route.route.execute(route.route, resolver, ctx, errorResponder);
    }
    return Promise.reject(new E_ROUTE_NOT_FOUND([method, url]));
  };
}

// src/server/factories/write_response.ts
function writeResponse(ctx) {
  return function() {
    try {
      ctx.response.finish();
    } catch (error) {
      ctx.logger.fatal({ err: error }, "Response serialization failed");
      ctx.response.internalServerError(error.message);
      ctx.response.finish();
    }
  };
}

// src/server/factories/middleware_handler.ts
function middlewareHandler(resolver, ctx) {
  return function(fn, next) {
    debug_default("executing middleware %s", fn.name);
    return fn.handle(resolver, ctx, next);
  };
}

// src/server/main.ts
var Server = class {
  #booted = false;
  /**
   * The default error handler to use
   */
  #defaultErrorHandler = {
    report() {
    },
    handle(error, ctx) {
      ctx.response.status(error.status || 500).send(error.message || "Internal server error");
    }
  };
  /**
   * Logger instance, a child logger is added
   * to the context to have request specific
   * logging capabilities.
   */
  #logger;
  /**
   * Registered error handler (if any)
   */
  #errorHandler;
  /**
   * Resolved error handler is an instance of the lazily imported error
   * handler class.
   */
  #resolvedErrorHandler = this.#defaultErrorHandler;
  /**
   * Emitter is required to notify when a request finishes
   */
  #emitter;
  /**
   * The application instance to be shared with the router
   */
  #app;
  /**
   * The encryption instance to be shared with the router
   */
  #encryption;
  /**
   * Server config
   */
  #config;
  /**
   * Query string parser used by the server
   */
  #qsParser;
  /**
   * Server middleware stack runs on every incoming HTTP request
   */
  #serverMiddlewareStack;
  /**
   * Reference to the router used by the server
   */
  #router;
  /**
   * Reference to the underlying Node HTTP server in use
   */
  #nodeHttpServer;
  /**
   * Middleware store to be shared with the routes
   */
  #middleware = [];
  /**
   * The request error response is attached to the middleware
   * pipeline to intercept errors and invoke the user
   * registered error handler.
   *
   * We share this with the route middleware pipeline as well,
   * so that it does not throw any exceptions
   */
  #requestErrorResponder = async (error, ctx) => {
    await this.#resolvedErrorHandler.report(error, ctx);
    return this.#resolvedErrorHandler.handle(error, ctx);
  };
  /**
   * Check if the server has already been booted
   */
  get booted() {
    return this.#booted;
  }
  /**
   * Know if async local storage is enabled or not.
   */
  get usingAsyncLocalStorage() {
    return asyncLocalStorage.isEnabled;
  }
  constructor(app, encryption, emitter, logger, config) {
    this.#app = app;
    this.#emitter = emitter;
    this.#config = config;
    this.#logger = logger;
    this.#encryption = encryption;
    this.#qsParser = new Qs(this.#config.qs);
    this.#router = new Router(this.#app, this.#encryption, this.#qsParser);
    this.#createAsyncLocalStore();
    debug_default("server config: %O", this.#config);
  }
  /**
   * Create async local storage store when enabled
   */
  #createAsyncLocalStore() {
    if (this.#config.useAsyncLocalStorage) {
      debug_default("creating ALS store for HTTP context");
      asyncLocalStorage.create();
    } else {
      asyncLocalStorage.destroy();
    }
  }
  /**
   * Creates an instance of the server middleware stack
   */
  #createServerMiddlewareStack() {
    this.#serverMiddlewareStack = new Middleware2();
    this.#middleware.forEach((middleware) => this.#serverMiddlewareStack.add(middleware));
    this.#serverMiddlewareStack.freeze();
    this.#middleware = [];
  }
  /**
   * Handles the HTTP request
   */
  #handleRequest(ctx, resolver) {
    return this.#serverMiddlewareStack.runner().errorHandler((error) => this.#requestErrorResponder(error, ctx)).finalHandler(finalHandler(this.#router, resolver, ctx, this.#requestErrorResponder)).run(middlewareHandler(resolver, ctx)).catch((error) => {
      ctx.logger.fatal({ err: error }, "Exception raised by error handler");
      return this.#defaultErrorHandler.handle(error, ctx);
    }).finally(writeResponse(ctx));
  }
  /**
   * Creates a pipeline of middleware.
   */
  pipeline(middleware) {
    const middlewareStack = new Middleware2();
    middleware.forEach((one) => {
      middlewareStack.add(moduleCaller2(one, "handle").toHandleMethod());
    });
    middlewareStack.freeze();
    const stackRunner = middlewareStack.runner();
    return {
      finalHandler(handler) {
        stackRunner.finalHandler(handler);
        return this;
      },
      errorHandler(handler) {
        stackRunner.errorHandler(handler);
        return this;
      },
      run(ctx) {
        return stackRunner.run((handler, next) => {
          return handler.handle(ctx.containerResolver, ctx, next);
        });
      }
    };
  }
  /**
   * Define an array of middleware to use on all the incoming HTTP request.
   * Calling this method multiple times pushes to the existing list
   * of middleware
   */
  use(middleware) {
    middleware.forEach(
      (one) => this.#middleware.push(moduleImporter4(one, "handle").toHandleMethod())
    );
    return this;
  }
  /**
   * Register a custom error handler for HTTP requests.
   * All errors will be reported to this method
   */
  errorHandler(handler) {
    this.#errorHandler = handler;
    return this;
  }
  /**
   * Boot the server. Calling this method performs the following actions.
   *
   * - Register routes with the store.
   * - Resolve and construct the error handler.
   */
  async boot() {
    if (this.#booted) {
      return;
    }
    debug_default("booting HTTP server");
    this.#createServerMiddlewareStack();
    this.#router.commit();
    if (this.#errorHandler) {
      if (debug_default.enabled) {
        debug_default('using custom error handler "%s"', this.#errorHandler);
      }
      const moduleExports = await this.#errorHandler();
      this.#resolvedErrorHandler = await this.#app.container.make(moduleExports.default);
    }
    this.#booted = true;
  }
  /**
   * Set the HTTP server instance used to listen for requests.
   */
  setNodeServer(server) {
    server.timeout = this.#config.timeout ?? server.timeout;
    server.keepAliveTimeout = this.#config.keepAliveTimeout ?? server.keepAliveTimeout;
    server.headersTimeout = this.#config.headersTimeout ?? server.headersTimeout;
    server.requestTimeout = this.#config.requestTimeout ?? server.requestTimeout;
    this.#nodeHttpServer = server;
  }
  /**
   * Returns reference to the underlying HTTP server
   * in use
   */
  getNodeServer() {
    return this.#nodeHttpServer;
  }
  /**
   * Returns reference to the router instance used
   * by the server.
   */
  getRouter() {
    return this.#router;
  }
  /**
   * Creates an instance of the [[Request]] class
   */
  createRequest(req, res) {
    return new Request(req, res, this.#encryption, this.#config, this.#qsParser);
  }
  /**
   * Creates an instance of the [[Response]] class
   */
  createResponse(req, res) {
    return new Response(req, res, this.#encryption, this.#config, this.#router, this.#qsParser);
  }
  /**
   * Creates an instance of the [[HttpContext]] class
   */
  createHttpContext(request, response, resolver) {
    return new HttpContext(
      request,
      response,
      this.#logger.child({ request_id: request.id() }),
      resolver
    );
  }
  /**
   * Handle request
   */
  handle(req, res) {
    const hasRequestListener = this.#emitter.hasListeners("http:request_completed");
    const startTime = hasRequestListener ? process.hrtime() : null;
    const resolver = this.#app.container.createResolver();
    const ctx = this.createHttpContext(
      this.createRequest(req, res),
      this.createResponse(req, res),
      resolver
    );
    if (startTime) {
      onFinished2(res, () => {
        this.#emitter.emit("http:request_completed", {
          ctx,
          duration: process.hrtime(startTime)
        });
      });
    }
    if (this.usingAsyncLocalStorage) {
      return asyncLocalStorage.storage.run(ctx, () => this.#handleRequest(ctx, resolver));
    }
    return this.#handleRequest(ctx, resolver);
  }
};

// src/define_config.ts
import proxyAddr from "proxy-addr";
import string3 from "@poppinss/utils/string";
import lodash3 from "@poppinss/utils/lodash";
function defineConfig(config) {
  const { trustProxy: trustProxy2, ...rest } = config;
  const defaults = {
    allowMethodSpoofing: false,
    trustProxy: proxyAddr.compile("loopback"),
    subdomainOffset: 2,
    generateRequestId: false,
    useAsyncLocalStorage: false,
    etag: false,
    jsonpCallbackName: "callback",
    cookie: {
      maxAge: "2h",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax"
    },
    qs: {
      parse: {
        depth: 5,
        parameterLimit: 1e3,
        allowSparse: false,
        arrayLimit: 20,
        comma: true
      },
      stringify: {
        encode: true,
        encodeValuesOnly: false,
        arrayFormat: "indices",
        skipNulls: false
      }
    }
  };
  const normalizedConfig = lodash3.merge({}, defaults, rest);
  if (normalizedConfig.cookie.maxAge) {
    normalizedConfig.cookie.maxAge = string3.seconds.parse(normalizedConfig.cookie.maxAge);
  }
  if (typeof trustProxy2 === "boolean") {
    const tpValue = trustProxy2;
    normalizedConfig.trustProxy = (_, __) => tpValue;
  } else if (typeof trustProxy2 === "string") {
    const tpValue = trustProxy2;
    normalizedConfig.trustProxy = proxyAddr.compile(tpValue);
  } else if (trustProxy2) {
    normalizedConfig.trustProxy = trustProxy2;
  }
  return normalizedConfig;
}

export {
  Route,
  BriskRoute,
  RouteResource,
  RouteGroup,
  parseRange,
  CookieClient,
  Request,
  Redirect,
  E_ROUTE_NOT_FOUND,
  E_CANNOT_LOOKUP_ROUTE,
  E_HTTP_EXCEPTION,
  E_HTTP_REQUEST_ABORTED,
  exceptions_exports,
  ResponseStatus,
  Response,
  Qs,
  Router,
  HttpContext,
  Server,
  defineConfig
};
//# sourceMappingURL=chunk-OLJ72AJE.js.map