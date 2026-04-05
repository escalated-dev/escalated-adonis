import {
  E_UNAUTHORIZED_ACCESS
} from "../../chunk-MUPAP5IP.js";
import "../../chunk-UXA4FHST.js";

// modules/session_guard/remember_me_token.ts
import { createHash } from "crypto";
import string from "@adonisjs/core/helpers/string";
import { Secret, base64, safeEqual } from "@adonisjs/core/helpers";
var RememberMeToken = class {
  /**
   * Decodes a publicly shared token and return the series
   * and the token value from it.
   *
   * Returns null when unable to decode the token because of
   * invalid format or encoding.
   */
  static decode(value) {
    if (typeof value !== "string") {
      return null;
    }
    if (!value) {
      return null;
    }
    const [identifier, ...tokenValue] = value.split(".");
    if (!identifier || tokenValue.length === 0) {
      return null;
    }
    const decodedIdentifier = base64.urlDecode(identifier);
    const decodedSecret = base64.urlDecode(tokenValue.join("."));
    if (!decodedIdentifier || !decodedSecret) {
      return null;
    }
    return {
      identifier: decodedIdentifier,
      secret: new Secret(decodedSecret)
    };
  }
  /**
   * Creates a transient token that can be shared with the persistence
   * layer.
   */
  static createTransientToken(userId, size, expiresIn) {
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + string.seconds.parse(expiresIn));
    return {
      userId,
      expiresAt,
      ...this.seed(size)
    };
  }
  /**
   * Creates a secret opaque token and its hash.
   */
  static seed(size) {
    const seed = string.random(size);
    const secret = new Secret(seed);
    const hash = createHash("sha256").update(secret.release()).digest("hex");
    return { secret, hash };
  }
  /**
   * Identifer is a unique sequence to identify the
   * token within database. It should be the
   * primary/unique key
   */
  identifier;
  /**
   * Reference to the user id for whom the token
   * is generated.
   */
  tokenableId;
  /**
   * The value is a public representation of a token. It is created
   * by combining the "identifier"."secret"
   */
  value;
  /**
   * Hash is computed from the seed to later verify the validity
   * of seed
   */
  hash;
  /**
   * Date/time when the token instance was created
   */
  createdAt;
  /**
   * Date/time when the token was updated
   */
  updatedAt;
  /**
   * Timestamp at which the token will expire
   */
  expiresAt;
  constructor(attributes) {
    this.identifier = attributes.identifier;
    this.tokenableId = attributes.tokenableId;
    this.hash = attributes.hash;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.expiresAt = attributes.expiresAt;
    if (attributes.secret) {
      this.value = new Secret(
        `${base64.urlEncode(String(this.identifier))}.${base64.urlEncode(
          attributes.secret.release()
        )}`
      );
    }
  }
  /**
   * Check if the token has been expired. Verifies
   * the "expiresAt" timestamp with the current
   * date.
   */
  isExpired() {
    return this.expiresAt < /* @__PURE__ */ new Date();
  }
  /**
   * Verifies the value of a token against the pre-defined hash
   */
  verify(secret) {
    const newHash = createHash("sha256").update(secret.release()).digest("hex");
    return safeEqual(this.hash, newHash);
  }
};

// modules/session_guard/guard.ts
import { Secret as Secret2 } from "@adonisjs/core/helpers";
import { RuntimeException } from "@adonisjs/core/exceptions";
var SessionGuard = class {
  /**
   * A unique name for the guard.
   */
  #name;
  /**
   * Reference to the current HTTP context
   */
  #ctx;
  /**
   * Options accepted by the session guard
   */
  #options;
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
  driverName = "session";
  /**
   * Whether or not the authentication has been attempted
   * during the current request.
   */
  authenticationAttempted = false;
  /**
   * A boolean to know if a remember me token was used in attempt
   * to login a user.
   */
  attemptedViaRemember = false;
  /**
   * A boolean to know if the current request has
   * been authenticated
   */
  isAuthenticated = false;
  /**
   * A boolean to know if the current request is authenticated
   * using the "rememember_me" token.
   */
  viaRemember = false;
  /**
   * Find if the user has been logged out during
   * the current request
   */
  isLoggedOut = false;
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
  /**
   * The key used to store the logged-in user id inside
   * session
   */
  get sessionKeyName() {
    return `auth_${this.#name}`;
  }
  /**
   * The key used to store the remember me token cookie
   */
  get rememberMeKeyName() {
    return `remember_${this.#name}`;
  }
  constructor(name, ctx, options, emitter, userProvider) {
    this.#name = name;
    this.#ctx = ctx;
    this.#options = { rememberMeTokensAge: "2 years", ...options };
    this.#emitter = emitter;
    this.#userProvider = userProvider;
  }
  /**
   * Returns the session instance for the given request,
   * ensuring the property exists
   */
  #getSession() {
    if (!("session" in this.#ctx)) {
      throw new RuntimeException(
        'Cannot authenticate user. Install and configure "@adonisjs/session" package'
      );
    }
    return this.#ctx.session;
  }
  /**
   * Emits authentication failure, updates the local state,
   * and returns an exception to end the authentication
   * cycle.
   */
  #authenticationFailed(sessionId) {
    this.isAuthenticated = false;
    this.viaRemember = false;
    this.user = void 0;
    this.isLoggedOut = false;
    const error = new E_UNAUTHORIZED_ACCESS("Invalid or expired user session", {
      guardDriverName: this.driverName
    });
    this.#emitter.emit("session_auth:authentication_failed", {
      ctx: this.#ctx,
      guardName: this.#name,
      error,
      sessionId
    });
    return error;
  }
  /**
   * Emits the authentication succeeded event and updates
   * the local state to reflect successful authentication
   */
  #authenticationSucceeded(sessionId, user, rememberMeToken) {
    this.isAuthenticated = true;
    this.viaRemember = !!rememberMeToken;
    this.user = user;
    this.isLoggedOut = false;
    this.#emitter.emit("session_auth:authentication_succeeded", {
      ctx: this.#ctx,
      guardName: this.#name,
      sessionId,
      user,
      rememberMeToken
    });
  }
  /**
   * Emits the login succeeded event and updates the login
   * state
   */
  #loginSucceeded(sessionId, user, rememberMeToken) {
    this.user = user;
    this.isLoggedOut = false;
    this.#emitter.emit("session_auth:login_succeeded", {
      ctx: this.#ctx,
      guardName: this.#name,
      sessionId,
      user,
      rememberMeToken
    });
  }
  /**
   * Creates session for a given user by their user id.
   */
  #createSessionForUser(userId) {
    const session = this.#getSession();
    session.put(this.sessionKeyName, userId);
    session.regenerate();
  }
  /**
   * Creates the remember me cookie
   */
  #createRememberMeCookie(value) {
    this.#ctx.response.encryptedCookie(this.rememberMeKeyName, value.release(), {
      maxAge: this.#options.rememberMeTokensAge,
      httpOnly: true
    });
  }
  /**
   * Authenticates the user using its id read from the session
   * store.
   *
   * - We check the user exists in the db
   * - If not, throw exception.
   * - Otherwise, update local state to mark the user as logged-in
   */
  async #authenticateViaId(userId, sessionId) {
    const providerUser = await this.#userProvider.findById(userId);
    if (!providerUser) {
      throw this.#authenticationFailed(sessionId);
    }
    this.#authenticationSucceeded(sessionId, providerUser.getOriginal());
    return this.user;
  }
  /**
   * Authenticates user from the remember me cookie. Creates a fresh
   * session for them and recycles the remember me token as well.
   */
  async #authenticateViaRememberCookie(rememberMeCookie, sessionId) {
    const userProvider = this.#userProvider;
    const token = await userProvider.verifyRememberToken(new Secret2(rememberMeCookie));
    if (!token) {
      throw this.#authenticationFailed(sessionId);
    }
    const providerUser = await userProvider.findById(token.tokenableId);
    if (!providerUser) {
      throw this.#authenticationFailed(sessionId);
    }
    const recycledToken = await userProvider.recycleRememberToken(
      providerUser.getOriginal(),
      token.identifier,
      this.#options.rememberMeTokensAge
    );
    this.#createRememberMeCookie(recycledToken.value);
    this.#createSessionForUser(providerUser.getId());
    this.#authenticationSucceeded(sessionId, providerUser.getOriginal(), token);
    return this.user;
  }
  /**
   * Returns an instance of the authenticated user. Or throws
   * an exception if the request is not authenticated.
   */
  getUserOrFail() {
    if (!this.user) {
      throw new E_UNAUTHORIZED_ACCESS("Invalid or expired user session", {
        guardDriverName: this.driverName
      });
    }
    return this.user;
  }
  /**
   * Login user using sessions. Optionally, you can also create
   * a remember me token to automatically login user when their
   * session expires.
   */
  async login(user, remember = false) {
    const session = this.#getSession();
    const providerUser = await this.#userProvider.createUserForGuard(user);
    this.#emitter.emit("session_auth:login_attempted", {
      ctx: this.#ctx,
      user,
      guardName: this.#name
    });
    let token;
    if (remember) {
      if (!this.#options.useRememberMeTokens) {
        throw new RuntimeException('Cannot use "rememberMe" feature. It has been disabled');
      }
      const userProvider = this.#userProvider;
      token = await userProvider.createRememberToken(
        providerUser.getOriginal(),
        this.#options.rememberMeTokensAge
      );
    }
    if (token) {
      this.#createRememberMeCookie(token.value);
    } else {
      this.#ctx.response.clearCookie(this.rememberMeKeyName);
    }
    this.#createSessionForUser(providerUser.getId());
    this.#loginSucceeded(session.sessionId, providerUser.getOriginal(), token);
  }
  /**
   * Logout a user by removing its state from the session
   * store and delete the remember me cookie (if any).
   */
  async logout() {
    const session = this.#getSession();
    const rememberMeCookie = this.#ctx.request.encryptedCookie(this.rememberMeKeyName);
    session.forget(this.sessionKeyName);
    this.#ctx.response.clearCookie(this.rememberMeKeyName);
    if (this.user && rememberMeCookie && this.#options.useRememberMeTokens) {
      const userProvider = this.#userProvider;
      const token = await userProvider.verifyRememberToken(new Secret2(rememberMeCookie));
      if (token) {
        await userProvider.deleteRemeberToken(this.user, token.identifier);
      }
    }
    this.#emitter.emit("session_auth:logged_out", {
      ctx: this.#ctx,
      guardName: this.#name,
      user: this.user || null,
      sessionId: session.sessionId
    });
    this.user = void 0;
    this.viaRemember = false;
    this.isAuthenticated = false;
    this.isLoggedOut = true;
  }
  /**
   * Authenticate the current HTTP request by verifying the bearer
   * token or fails with an exception
   */
  async authenticate() {
    if (this.authenticationAttempted) {
      return this.getUserOrFail();
    }
    this.authenticationAttempted = true;
    const session = this.#getSession();
    this.#emitter.emit("session_auth:authentication_attempted", {
      ctx: this.#ctx,
      sessionId: session.sessionId,
      guardName: this.#name
    });
    const authUserId = session.get(this.sessionKeyName);
    if (authUserId) {
      return this.#authenticateViaId(authUserId, session.sessionId);
    }
    const rememberMeCookie = this.#ctx.request.encryptedCookie(this.rememberMeKeyName);
    if (rememberMeCookie && this.#options.useRememberMeTokens) {
      this.attemptedViaRemember = true;
      return this.#authenticateViaRememberCookie(rememberMeCookie, session.sessionId);
    }
    throw this.#authenticationFailed(session.sessionId);
  }
  /**
   * Silently check if the user is authenticated or not, without
   * throwing any exceptions
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
   * Returns the session info for the clients to send during
   * an HTTP request to mark the user as logged-in.
   */
  async authenticateAsClient(user) {
    const providerUser = await this.#userProvider.createUserForGuard(user);
    const userId = providerUser.getId();
    return {
      session: {
        [this.sessionKeyName]: userId
      }
    };
  }
};

// modules/session_guard/token_providers/db.ts
import { inspect } from "util";
import { RuntimeException as RuntimeException2 } from "@adonisjs/core/exceptions";
var DbRememberMeTokensProvider = class _DbRememberMeTokensProvider {
  constructor(options) {
    this.options = options;
    this.table = options.table || "remember_me_tokens";
    this.tokenSecretLength = options.tokenSecretLength || 40;
  }
  /**
   * Create tokens provider instance for a given Lucid model
   */
  static forModel(model, options) {
    return new _DbRememberMeTokensProvider({
      tokenableModel: model,
      ...options || {}
    });
  }
  /**
   * Database table to use for querying remember me tokens
   */
  table;
  /**
   * The length for the token secret. A secret is a cryptographically
   * secure random string.
   */
  tokenSecretLength;
  /**
   * Check if value is an object
   */
  #isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  /**
   * Ensure the provided user is an instance of the user model and
   * has a primary key
   */
  #ensureIsPersisted(user) {
    const model = this.options.tokenableModel;
    if (user instanceof model === false) {
      throw new RuntimeException2(
        `Invalid user object. It must be an instance of the "${model.name}" model`
      );
    }
    if (!user.$primaryKeyValue) {
      throw new RuntimeException2(
        `Cannot use "${model.name}" model for managing remember me tokens. The value of column "${model.primaryKey}" is undefined or null`
      );
    }
  }
  /**
   * Maps a database row to an instance token instance
   */
  dbRowToRememberMeToken(dbRow) {
    return new RememberMeToken({
      identifier: dbRow.id,
      tokenableId: dbRow.tokenable_id,
      hash: dbRow.hash,
      createdAt: typeof dbRow.created_at === "number" ? new Date(dbRow.created_at) : dbRow.created_at,
      updatedAt: typeof dbRow.updated_at === "number" ? new Date(dbRow.updated_at) : dbRow.updated_at,
      expiresAt: typeof dbRow.expires_at === "number" ? new Date(dbRow.expires_at) : dbRow.expires_at
    });
  }
  /**
   * Returns a query client instance from the parent model
   */
  async getDb() {
    const model = this.options.tokenableModel;
    return model.$adapter.query(model).client;
  }
  /**
   * Create a token for a user
   */
  async create(user, expiresIn) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const transientToken = RememberMeToken.createTransientToken(
      user.$primaryKeyValue,
      this.tokenSecretLength,
      expiresIn
    );
    const dbRow = {
      tokenable_id: transientToken.userId,
      hash: transientToken.hash,
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date(),
      expires_at: transientToken.expiresAt
    };
    const result = await queryClient.table(this.table).insert(dbRow).returning("id");
    const id = this.#isObject(result[0]) ? result[0].id : result[0];
    if (!id) {
      throw new RuntimeException2(
        `Cannot save access token. The result "${inspect(result)}" of insert query is unexpected`
      );
    }
    return new RememberMeToken({
      identifier: id,
      tokenableId: dbRow.tokenable_id,
      secret: transientToken.secret,
      hash: dbRow.hash,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
      expiresAt: dbRow.expires_at
    });
  }
  /**
   * Find a token for a user by the token id
   */
  async find(user, identifier) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const dbRow = await queryClient.query().from(this.table).where({ id: identifier, tokenable_id: user.$primaryKeyValue }).limit(1).first();
    if (!dbRow) {
      return null;
    }
    return this.dbRowToRememberMeToken(dbRow);
  }
  /**
   * Delete a token by its id
   */
  async delete(user, identifier) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const affectedRows = await queryClient.query().from(this.table).where({ id: identifier, tokenable_id: user.$primaryKeyValue }).del().exec();
    return affectedRows;
  }
  /**
   * Returns all the tokens a given user
   */
  async all(user) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const dbRows = await queryClient.query().from(this.table).where({ tokenable_id: user.$primaryKeyValue }).orderBy("id", "desc").exec();
    return dbRows.map((dbRow) => {
      return this.dbRowToRememberMeToken(dbRow);
    });
  }
  /**
   * Verifies a publicly shared remember me token and returns an
   * RememberMeToken for it.
   *
   * Returns null when unable to verify the token or find it
   * inside the storage
   */
  async verify(tokenValue) {
    const decodedToken = RememberMeToken.decode(tokenValue.release());
    if (!decodedToken) {
      return null;
    }
    const db = await this.getDb();
    const dbRow = await db.query().from(this.table).where({ id: decodedToken.identifier }).limit(1).first();
    if (!dbRow) {
      return null;
    }
    const rememberMeToken = this.dbRowToRememberMeToken(dbRow);
    if (!rememberMeToken.verify(decodedToken.secret) || rememberMeToken.isExpired()) {
      return null;
    }
    return rememberMeToken;
  }
  /**
   * Recycles a remember me token by deleting the old one and
   * creates a new one.
   *
   * Ideally, the recycle should update the existing token, but we
   * skip that for now and come back to it later and handle race
   * conditions as well.
   */
  async recycle(user, identifier, expiresIn) {
    await this.delete(user, identifier);
    return this.create(user, expiresIn);
  }
};

// modules/session_guard/user_providers/lucid.ts
import { RuntimeException as RuntimeException3 } from "@adonisjs/core/exceptions";
var SessionLucidUserProvider = class {
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
   * Returns the tokens provider associated with the user model
   */
  async getTokensProvider() {
    const model = await this.getModel();
    if (!model.rememberMeTokens) {
      throw new RuntimeException3(
        `Cannot use "${model.name}" model for verifying remember me tokens. Make sure to assign a token provider to the model.`
      );
    }
    return model.rememberMeTokens;
  }
  /**
   * Creates an adapter user for the guard
   */
  async createUserForGuard(user) {
    const model = await this.getModel();
    if (user instanceof model === false) {
      throw new RuntimeException3(
        `Invalid user object. It must be an instance of the "${model.name}" model`
      );
    }
    return {
      getId() {
        if (!user.$primaryKeyValue) {
          throw new RuntimeException3(
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
   * Finds a user by their primary key value
   */
  async findById(identifier) {
    const model = await this.getModel();
    const user = await model.find(identifier);
    if (!user) {
      return null;
    }
    return this.createUserForGuard(user);
  }
  /**
   * Creates a remember token for a given user
   */
  async createRememberToken(user, expiresIn) {
    const tokensProvider = await this.getTokensProvider();
    return tokensProvider.create(user, expiresIn);
  }
  /**
   * Verify a token by its publicly shared value
   */
  async verifyRememberToken(tokenValue) {
    const tokensProvider = await this.getTokensProvider();
    return tokensProvider.verify(tokenValue);
  }
  /**
   * Delete a token for a user by the token identifier
   */
  async deleteRemeberToken(user, identifier) {
    const tokensProvider = await this.getTokensProvider();
    return tokensProvider.delete(user, identifier);
  }
  /**
   * Recycle a token for a user by the token identifier
   */
  async recycleRememberToken(user, identifier, expiresIn) {
    const tokensProvider = await this.getTokensProvider();
    return tokensProvider.recycle(user, identifier, expiresIn);
  }
};

// modules/session_guard/define_config.ts
function sessionGuard(config) {
  return {
    async resolver(name, app) {
      const emitter = await app.container.make("emitter");
      const provider = "resolver" in config.provider ? await config.provider.resolver(app) : config.provider;
      return (ctx) => new SessionGuard(name, ctx, config, emitter, provider);
    }
  };
}
function sessionUserProvider(config) {
  return new SessionLucidUserProvider(config);
}
export {
  DbRememberMeTokensProvider,
  RememberMeToken,
  SessionGuard,
  SessionLucidUserProvider,
  sessionGuard,
  sessionUserProvider
};
