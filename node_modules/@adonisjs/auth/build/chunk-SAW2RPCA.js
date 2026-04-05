import {
  debug_default
} from "./chunk-2VRS2VHB.js";
import {
  E_UNAUTHORIZED_ACCESS
} from "./chunk-MUPAP5IP.js";

// src/authenticator.ts
import { RuntimeException } from "@adonisjs/core/exceptions";
var Authenticator = class {
  /**
   * Registered guards
   */
  #config;
  /**
   * Cache of guards created during the HTTP request
   */
  #guardsCache = {};
  /**
   * Last guard that was used to perform the authentication via
   * the "authenticateUsing" method.
   *
   * @note
   * Reset on every call made to "authenticate", "check" and
   * "authenticateUsing" method.
   */
  #authenticationAttemptedViaGuard;
  /**
   * Name of the guard using which the request has
   * been authenticated successfully.
   *
   * @note
   * Reset on every call made to "authenticate", "check" and
   * "authenticateUsing" method.
   */
  #authenticatedViaGuard;
  /**
   * Reference to HTTP context
   */
  #ctx;
  /**
   * Name of the default guard
   */
  get defaultGuard() {
    return this.#config.default;
  }
  /**
   * Reference to the guard using which the current
   * request has been authenticated.
   */
  get authenticatedViaGuard() {
    return this.#authenticatedViaGuard;
  }
  /**
   * A boolean to know if the current request has been authenticated. The
   * property returns false when "authenticate" or "authenticateUsing"
   * methods are not used.
   */
  get isAuthenticated() {
    if (!this.#authenticationAttemptedViaGuard) {
      return false;
    }
    return this.use(this.#authenticationAttemptedViaGuard).isAuthenticated;
  }
  /**
   * Reference to the currently authenticated user. The property returns
   * undefined when "authenticate" or "authenticateUsing" methods are
   * not used.
   */
  get user() {
    if (!this.#authenticationAttemptedViaGuard) {
      return void 0;
    }
    return this.use(this.#authenticationAttemptedViaGuard).user;
  }
  /**
   * Whether or not the authentication has been attempted during
   * the current request. The property returns false when the
   * "authenticate" or "authenticateUsing" methods are not
   * used.
   */
  get authenticationAttempted() {
    if (!this.#authenticationAttemptedViaGuard) {
      return false;
    }
    return this.use(this.#authenticationAttemptedViaGuard).authenticationAttempted;
  }
  constructor(ctx, config) {
    this.#ctx = ctx;
    this.#config = config;
    debug_default("creating authenticator. config %O", this.#config);
  }
  /**
   * Returns an instance of the logged-in user or throws an
   * exception
   */
  getUserOrFail() {
    if (!this.#authenticationAttemptedViaGuard) {
      throw new RuntimeException(
        'Cannot access authenticated user. Please call "auth.authenticate" method first.'
      );
    }
    return this.use(this.#authenticationAttemptedViaGuard).getUserOrFail();
  }
  /**
   * Returns an instance of a known guard. Guards instances are
   * cached during the lifecycle of an HTTP request.
   */
  use(guard) {
    const guardToUse = guard || this.#config.default;
    const cachedGuard = this.#guardsCache[guardToUse];
    if (cachedGuard) {
      debug_default('authenticator: using guard from cache. name: "%s"', guardToUse);
      return cachedGuard;
    }
    const guardFactory = this.#config.guards[guardToUse];
    debug_default('authenticator: creating guard. name: "%s"', guardToUse);
    const guardInstance = guardFactory(this.#ctx);
    this.#guardsCache[guardToUse] = guardInstance;
    return guardInstance;
  }
  /**
   * Authenticate current request using the default guard. Calling this
   * method multiple times triggers multiple authentication with the
   * guard.
   */
  async authenticate() {
    await this.authenticateUsing();
    return this.getUserOrFail();
  }
  /**
   * Silently attempt to authenticate the request using the default
   * guard. Calling this method multiple times triggers multiple
   * authentication with the guard.
   */
  async check() {
    this.#authenticationAttemptedViaGuard = this.defaultGuard;
    const isAuthenticated = await this.use().check();
    if (isAuthenticated) {
      this.#authenticatedViaGuard = this.defaultGuard;
    }
    return isAuthenticated;
  }
  /**
   * Authenticate the request using all of the mentioned guards
   * or the default guard.
   *
   * The authentication process will stop after any of the mentioned
   * guards is able to authenticate the request successfully.
   *
   * Otherwise, "E_UNAUTHORIZED_ACCESS" will be raised.
   */
  async authenticateUsing(guards, options) {
    const guardsToUse = guards || [this.defaultGuard];
    let lastUsedDriver;
    for (let guardName of guardsToUse) {
      debug_default('attempting to authenticate using guard "%s"', guardName);
      this.#authenticationAttemptedViaGuard = guardName;
      const guard = this.use(guardName);
      lastUsedDriver = guard.driverName;
      if (await guard.check()) {
        this.#authenticatedViaGuard = guardName;
        return this.getUserOrFail();
      }
    }
    throw new E_UNAUTHORIZED_ACCESS("Unauthorized access", {
      guardDriverName: lastUsedDriver,
      redirectTo: options?.loginRoute
    });
  }
  /**
   * Silently attempt to authenticate the request using all of the mentioned guards
   * or the default guard. Calling this method multiple times triggers multiple
   * authentication with the guard.
   */
  async checkUsing(guards = [this.defaultGuard]) {
    for (const name of guards) {
      this.#authenticationAttemptedViaGuard = name;
      const isAuthenticated = await this.use(name).check();
      if (isAuthenticated) {
        this.#authenticatedViaGuard = name;
        return true;
      }
    }
    return false;
  }
};

// src/authenticator_client.ts
import { HttpContextFactory } from "@adonisjs/core/factories/http";
var AuthenticatorClient = class {
  /**
   * Registered guards
   */
  #config;
  /**
   * Cache of guards
   */
  #guardsCache = {};
  /**
   * Name of the default guard
   */
  get defaultGuard() {
    return this.#config.default;
  }
  constructor(config) {
    this.#config = config;
    debug_default("creating authenticator client. config %O", this.#config);
  }
  /**
   * Returns an instance of a known guard. Guards instances are
   * cached during the lifecycle of an HTTP request.
   */
  use(guard) {
    const guardToUse = guard || this.#config.default;
    const cachedGuard = this.#guardsCache[guardToUse];
    if (cachedGuard) {
      debug_default('authenticator client: using guard from cache. name: "%s"', guardToUse);
      return cachedGuard;
    }
    const guardFactory = this.#config.guards[guardToUse];
    debug_default('authenticator client: creating guard. name: "%s"', guardToUse);
    const guardInstance = guardFactory(new HttpContextFactory().create());
    this.#guardsCache[guardToUse] = guardInstance;
    return guardInstance;
  }
};

// src/auth_manager.ts
var AuthManager = class {
  constructor(config) {
    this.config = config;
    this.config = config;
  }
  /**
   * Name of the default guard
   */
  get defaultGuard() {
    return this.config.default;
  }
  /**
   * Create an authenticator for a given HTTP request. The authenticator
   * is used to authenticated in incoming HTTP request
   */
  createAuthenticator(ctx) {
    return new Authenticator(ctx, this.config);
  }
  /**
   * Creates an instance of the authenticator client. The client is
   * used to setup authentication state during testing.
   */
  createAuthenticatorClient() {
    return new AuthenticatorClient(this.config);
  }
};

export {
  Authenticator,
  AuthenticatorClient,
  AuthManager
};
