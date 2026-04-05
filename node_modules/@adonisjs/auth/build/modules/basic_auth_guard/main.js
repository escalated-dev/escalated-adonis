import {
  E_UNAUTHORIZED_ACCESS
} from "../../chunk-MUPAP5IP.js";
import "../../chunk-UXA4FHST.js";

// modules/basic_auth_guard/guard.ts
import auth from "basic-auth";
import { base64 } from "@adonisjs/core/helpers";
var BasicAuthGuard = class {
  /**
   * A unique name for the guard.
   */
  #name;
  /**
   * Reference to the current HTTP context
   */
  #ctx;
  /**
   * Provider to lookup user details
   */
  #userProvider;
  /**
   * Emitter to emit events
   */
  #emitter;
  /**
   * Driver name of the guard
   */
  driverName = "basic_auth";
  /**
   * Whether or not the authentication has been attempted
   * during the current request.
   */
  authenticationAttempted = false;
  /**
   * A boolean to know if the current request has
   * been authenticated
   */
  isAuthenticated = false;
  /**
   * Reference to an instance of the authenticated user.
   * The value only exists after calling one of the
   * following methods.
   *
   * - authenticate
   * - check
   *
   * You can use the "getUserOrFail" method to throw an exception if
   * the request is not authenticated.
   */
  user;
  constructor(name, ctx, emitter, userProvider) {
    this.#name = name;
    this.#ctx = ctx;
    this.#emitter = emitter;
    this.#userProvider = userProvider;
  }
  /**
   * Emits authentication failure, updates the local state,
   * and returns an exception to end the authentication
   * cycle.
   */
  #authenticationFailed() {
    this.isAuthenticated = false;
    this.user = void 0;
    const error = new E_UNAUTHORIZED_ACCESS("Invalid basic auth credentials", {
      guardDriverName: this.driverName
    });
    this.#emitter.emit("basic_auth:authentication_failed", {
      ctx: this.#ctx,
      guardName: this.#name,
      error
    });
    return error;
  }
  /**
   * Emits the authentication succeeded event and updates
   * the local state to reflect successful authentication
   */
  #authenticationSucceeded(user) {
    this.isAuthenticated = true;
    this.user = user;
    this.#emitter.emit("basic_auth:authentication_succeeded", {
      ctx: this.#ctx,
      guardName: this.#name,
      user
    });
  }
  /**
   * Returns an instance of the authenticated user. Or throws
   * an exception if the request is not authenticated.
   */
  getUserOrFail() {
    if (!this.user) {
      throw new E_UNAUTHORIZED_ACCESS("Invalid basic auth credentials", {
        guardDriverName: this.driverName
      });
    }
    return this.user;
  }
  /**
   * Authenticates the incoming HTTP request by looking for BasicAuth
   * credentials inside the request authorization header.
   *
   * Returns the authenticated user or throws an exception.
   */
  async authenticate() {
    if (this.authenticationAttempted) {
      return this.getUserOrFail();
    }
    this.authenticationAttempted = true;
    this.#emitter.emit("basic_auth:authentication_attempted", {
      ctx: this.#ctx,
      guardName: this.#name
    });
    const credentials = auth(this.#ctx.request.request);
    if (!credentials) {
      throw this.#authenticationFailed();
    }
    const user = await this.#userProvider.verifyCredentials(credentials.name, credentials.pass);
    if (!user) {
      throw this.#authenticationFailed();
    }
    this.#authenticationSucceeded(user.getOriginal());
    return this.getUserOrFail();
  }
  /**
   * Silently attempt to authenticate the user.
   *
   * The method returns a boolean indicating if the authentication
   * succeeded or failed.
   */
  async check() {
    try {
      await this.authenticate();
      return true;
    } catch (error) {
      if (error instanceof E_UNAUTHORIZED_ACCESS) {
        return false;
      }
      throw error;
    }
  }
  /**
   * Does not support authenticating as client. Instead use "basicAuth"
   * helper on Japa APIClient
   */
  async authenticateAsClient(uid, password) {
    return {
      headers: {
        authorization: `Basic ${base64.encode(`${uid}:${password}`)}`
      }
    };
  }
};

// modules/basic_auth_guard/user_providers/lucid.ts
import { RuntimeException } from "@adonisjs/core/exceptions";
var BasicAuthLucidUserProvider = class {
  constructor(options) {
    this.options = options;
  }
  /**
   * Reference to the lazily imported model
   */
  model;
  /**
   * Imports the model from the provider, returns and caches it
   * for further operations.
   */
  async getModel() {
    if (this.model && !("hot" in import.meta)) {
      return this.model;
    }
    const importedModel = await this.options.model();
    this.model = importedModel.default;
    return this.model;
  }
  /**
   * Creates an adapter user for the guard
   */
  async createUserForGuard(user) {
    const model = await this.getModel();
    if (user instanceof model === false) {
      throw new RuntimeException(
        `Invalid user object. It must be an instance of the "${model.name}" model`
      );
    }
    return {
      getId() {
        if (!user.$primaryKeyValue) {
          throw new RuntimeException(
            `Cannot use "${model.name}" model for authentication. The value of column "${model.primaryKey}" is undefined or null`
          );
        }
        return user.$primaryKeyValue;
      },
      getOriginal() {
        return user;
      }
    };
  }
  /**
   * Verifies credentials using the underlying model
   */
  async verifyCredentials(uid, password) {
    const model = await this.getModel();
    try {
      const user = await model.verifyCredentials(uid, password);
      return this.createUserForGuard(user);
    } catch {
      return null;
    }
  }
};

// modules/basic_auth_guard/define_config.ts
function basicAuthGuard(config) {
  return {
    async resolver(name, app) {
      const emitter = await app.container.make("emitter");
      const provider = "resolver" in config.provider ? await config.provider.resolver(app) : config.provider;
      return (ctx) => new BasicAuthGuard(name, ctx, emitter, provider);
    }
  };
}
function basicAuthUserProvider(config) {
  return new BasicAuthLucidUserProvider(config);
}
export {
  BasicAuthGuard,
  BasicAuthLucidUserProvider,
  basicAuthGuard,
  basicAuthUserProvider
};
