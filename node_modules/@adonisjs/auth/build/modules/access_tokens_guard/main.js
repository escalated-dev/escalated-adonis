import {
  E_UNAUTHORIZED_ACCESS
} from "../../chunk-MUPAP5IP.js";
import "../../chunk-UXA4FHST.js";

// modules/access_tokens_guard/access_token.ts
import { createHash } from "crypto";
import string from "@adonisjs/core/helpers/string";
import { RuntimeException } from "@adonisjs/core/exceptions";
import { Secret, base64, safeEqual } from "@adonisjs/core/helpers";

// modules/access_tokens_guard/crc32.ts
var CRC32 = class {
  /**
   * Lookup table calculated for 0xEDB88320 divisor
   */
  #lookupTable = [
    0,
    1996959894,
    3993919788,
    2567524794,
    124634137,
    1886057615,
    3915621685,
    2657392035,
    249268274,
    2044508324,
    3772115230,
    2547177864,
    162941995,
    2125561021,
    3887607047,
    2428444049,
    498536548,
    1789927666,
    4089016648,
    2227061214,
    450548861,
    1843258603,
    4107580753,
    2211677639,
    325883990,
    1684777152,
    4251122042,
    2321926636,
    335633487,
    1661365465,
    4195302755,
    2366115317,
    997073096,
    1281953886,
    3579855332,
    2724688242,
    1006888145,
    1258607687,
    3524101629,
    2768942443,
    901097722,
    1119000684,
    3686517206,
    2898065728,
    853044451,
    1172266101,
    3705015759,
    2882616665,
    651767980,
    1373503546,
    3369554304,
    3218104598,
    565507253,
    1454621731,
    3485111705,
    3099436303,
    671266974,
    1594198024,
    3322730930,
    2970347812,
    795835527,
    1483230225,
    3244367275,
    3060149565,
    1994146192,
    31158534,
    2563907772,
    4023717930,
    1907459465,
    112637215,
    2680153253,
    3904427059,
    2013776290,
    251722036,
    2517215374,
    3775830040,
    2137656763,
    141376813,
    2439277719,
    3865271297,
    1802195444,
    476864866,
    2238001368,
    4066508878,
    1812370925,
    453092731,
    2181625025,
    4111451223,
    1706088902,
    314042704,
    2344532202,
    4240017532,
    1658658271,
    366619977,
    2362670323,
    4224994405,
    1303535960,
    984961486,
    2747007092,
    3569037538,
    1256170817,
    1037604311,
    2765210733,
    3554079995,
    1131014506,
    879679996,
    2909243462,
    3663771856,
    1141124467,
    855842277,
    2852801631,
    3708648649,
    1342533948,
    654459306,
    3188396048,
    3373015174,
    1466479909,
    544179635,
    3110523913,
    3462522015,
    1591671054,
    702138776,
    2966460450,
    3352799412,
    1504918807,
    783551873,
    3082640443,
    3233442989,
    3988292384,
    2596254646,
    62317068,
    1957810842,
    3939845945,
    2647816111,
    81470997,
    1943803523,
    3814918930,
    2489596804,
    225274430,
    2053790376,
    3826175755,
    2466906013,
    167816743,
    2097651377,
    4027552580,
    2265490386,
    503444072,
    1762050814,
    4150417245,
    2154129355,
    426522225,
    1852507879,
    4275313526,
    2312317920,
    282753626,
    1742555852,
    4189708143,
    2394877945,
    397917763,
    1622183637,
    3604390888,
    2714866558,
    953729732,
    1340076626,
    3518719985,
    2797360999,
    1068828381,
    1219638859,
    3624741850,
    2936675148,
    906185462,
    1090812512,
    3747672003,
    2825379669,
    829329135,
    1181335161,
    3412177804,
    3160834842,
    628085408,
    1382605366,
    3423369109,
    3138078467,
    570562233,
    1426400815,
    3317316542,
    2998733608,
    733239954,
    1555261956,
    3268935591,
    3050360625,
    752459403,
    1541320221,
    2607071920,
    3965973030,
    1969922972,
    40735498,
    2617837225,
    3943577151,
    1913087877,
    83908371,
    2512341634,
    3803740692,
    2075208622,
    213261112,
    2463272603,
    3855990285,
    2094854071,
    198958881,
    2262029012,
    4057260610,
    1759359992,
    534414190,
    2176718541,
    4139329115,
    1873836001,
    414664567,
    2282248934,
    4279200368,
    1711684554,
    285281116,
    2405801727,
    4167216745,
    1634467795,
    376229701,
    2685067896,
    3608007406,
    1308918612,
    956543938,
    2808555105,
    3495958263,
    1231636301,
    1047427035,
    2932959818,
    3654703836,
    1088359270,
    936918e3,
    2847714899,
    3736837829,
    1202900863,
    817233897,
    3183342108,
    3401237130,
    1404277552,
    615818150,
    3134207493,
    3453421203,
    1423857449,
    601450431,
    3009837614,
    3294710456,
    1567103746,
    711928724,
    3020668471,
    3272380065,
    1510334235,
    755167117
  ];
  #initialCRC = 4294967295;
  #calculateBytes(bytes, accumulator) {
    let crc = accumulator || this.#initialCRC;
    for (const byte of bytes) {
      const tableIndex = (crc ^ byte) & 255;
      const tableVal = this.#lookupTable[tableIndex];
      crc = crc >>> 8 ^ tableVal;
    }
    return crc;
  }
  #crcToUint(crc) {
    return this.#toUint32(crc ^ 4294967295);
  }
  #strToBytes(input) {
    const encoder = new TextEncoder();
    return encoder.encode(input);
  }
  #toUint32(num) {
    if (num >= 0) {
      return num;
    }
    return 4294967295 - num * -1 + 1;
  }
  calculate(input) {
    return this.forString(input);
  }
  forString(input) {
    const bytes = this.#strToBytes(input);
    return this.forBytes(bytes);
  }
  forBytes(bytes, accumulator) {
    const crc = this.#calculateBytes(bytes, accumulator);
    return this.#crcToUint(crc);
  }
};

// modules/access_tokens_guard/access_token.ts
var AccessToken = class {
  /**
   * Decodes a publicly shared token and return the series
   * and the token value from it.
   *
   * Returns null when unable to decode the token because of
   * invalid format or encoding.
   */
  static decode(prefix, value) {
    if (typeof value !== "string" || !value.startsWith(`${prefix}`)) {
      return null;
    }
    const token = value.replace(new RegExp(`^${prefix}`), "");
    if (!token) {
      return null;
    }
    const [identifier, ...tokenValue] = token.split(".");
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
    let expiresAt;
    if (expiresIn) {
      expiresAt = /* @__PURE__ */ new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + string.seconds.parse(expiresIn));
    }
    return {
      userId,
      expiresAt,
      ...this.seed(size)
    };
  }
  /**
   * Creates a secret opaque token and its hash. The secret is
   * suffixed with a crc32 checksum for secret scanning tools
   * to easily identify the token.
   */
  static seed(size) {
    const seed = string.random(size);
    const secret = new Secret(`${seed}${new CRC32().calculate(seed)}`);
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
   * Recognizable name for the token
   */
  name;
  /**
   * A unique type to identify a bucket of tokens inside the
   * storage layer.
   */
  type;
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
   * Timestamp at which the token was used for authentication
   */
  lastUsedAt;
  /**
   * Timestamp at which the token will expire
   */
  expiresAt;
  /**
   * An array of abilities the token can perform. The abilities
   * is an array of abritary string values
   */
  abilities;
  constructor(attributes) {
    this.identifier = attributes.identifier;
    this.tokenableId = attributes.tokenableId;
    this.name = attributes.name;
    this.hash = attributes.hash;
    this.type = attributes.type;
    this.createdAt = attributes.createdAt;
    this.updatedAt = attributes.updatedAt;
    this.expiresAt = attributes.expiresAt;
    this.lastUsedAt = attributes.lastUsedAt;
    this.abilities = attributes.abilities || ["*"];
    if (attributes.secret) {
      if (!attributes.prefix) {
        throw new RuntimeException("Cannot compute token value without the prefix");
      }
      this.value = new Secret(
        `${attributes.prefix}${base64.urlEncode(String(this.identifier))}.${base64.urlEncode(
          attributes.secret.release()
        )}`
      );
    }
  }
  /**
   * Check if the token allows the given ability.
   */
  allows(ability) {
    return this.abilities.includes(ability) || this.abilities.includes("*");
  }
  /**
   * Check if the token denies the ability.
   */
  denies(ability) {
    return !this.abilities.includes(ability) && !this.abilities.includes("*");
  }
  /**
   * Authorize ability access using the current access token
   */
  authorize(ability) {
    if (this.denies(ability)) {
      throw new E_UNAUTHORIZED_ACCESS("Unauthorized access", { guardDriverName: "access_tokens" });
    }
  }
  /**
   * Check if the token has been expired. Verifies
   * the "expiresAt" timestamp with the current
   * date.
   *
   * Tokens with no expiry never expire
   */
  isExpired() {
    if (!this.expiresAt) {
      return false;
    }
    return this.expiresAt < /* @__PURE__ */ new Date();
  }
  /**
   * Verifies the value of a token against the pre-defined hash
   */
  verify(secret) {
    const newHash = createHash("sha256").update(secret.release()).digest("hex");
    return safeEqual(this.hash, newHash);
  }
  toJSON() {
    return {
      type: "bearer",
      name: this.name,
      token: this.value ? this.value.release() : void 0,
      abilities: this.abilities,
      lastUsedAt: this.lastUsedAt,
      expiresAt: this.expiresAt
    };
  }
};

// modules/access_tokens_guard/guard.ts
import { Secret as Secret2 } from "@adonisjs/core/helpers";
var AccessTokensGuard = class {
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
  driverName = "access_tokens";
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
   * Emits authentication failure and returns an exception
   * to end the authentication cycle.
   */
  #authenticationFailed() {
    const error = new E_UNAUTHORIZED_ACCESS("Unauthorized access", {
      guardDriverName: this.driverName
    });
    this.#emitter.emit("access_tokens_auth:authentication_failed", {
      ctx: this.#ctx,
      guardName: this.#name,
      error
    });
    return error;
  }
  /**
   * Returns the bearer token from the request headers or fails
   */
  #getBearerToken() {
    const bearerToken = this.#ctx.request.header("authorization", "");
    const [type, token] = bearerToken.split(" ");
    if (!type || type.toLowerCase() !== "bearer" || !token) {
      throw this.#authenticationFailed();
    }
    return token;
  }
  /**
   * Returns an instance of the authenticated user. Or throws
   * an exception if the request is not authenticated.
   */
  getUserOrFail() {
    if (!this.user) {
      throw new E_UNAUTHORIZED_ACCESS("Unauthorized access", {
        guardDriverName: this.driverName
      });
    }
    return this.user;
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
    this.#emitter.emit("access_tokens_auth:authentication_attempted", {
      ctx: this.#ctx,
      guardName: this.#name
    });
    const bearerToken = new Secret2(this.#getBearerToken());
    const token = await this.#userProvider.verifyToken(bearerToken);
    if (!token) {
      throw this.#authenticationFailed();
    }
    const providerUser = await this.#userProvider.findById(token.tokenableId);
    if (!providerUser) {
      throw this.#authenticationFailed();
    }
    this.isAuthenticated = true;
    this.user = providerUser.getOriginal();
    this.user.currentAccessToken = token;
    this.#emitter.emit("access_tokens_auth:authentication_succeeded", {
      ctx: this.#ctx,
      token,
      guardName: this.#name,
      user: this.user
    });
    return this.user;
  }
  /**
   * Create a token for a user (sign in)
   */
  async createToken(user, abilities, options) {
    return await this.#userProvider.createToken(user, abilities, options);
  }
  /**
   * Invalidates the currently authenticated token (sign out)
   */
  async invalidateToken() {
    const bearerToken = new Secret2(this.#getBearerToken());
    return await this.#userProvider.invalidateToken(bearerToken);
  }
  /**
   * Returns the Authorization header clients can use to authenticate
   * the request.
   */
  async authenticateAsClient(user, abilities, options) {
    const token = await this.#userProvider.createToken(user, abilities, options);
    return {
      headers: {
        authorization: `Bearer ${token.value.release()}`
      }
    };
  }
  /**
   * Silently check if the user is authenticated or not. The
   * method is same the "authenticate" method but does not
   * throw any exceptions.
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
};

// modules/access_tokens_guard/token_providers/db.ts
import { inspect } from "util";
import { RuntimeException as RuntimeException2 } from "@adonisjs/core/exceptions";
var DbAccessTokensProvider = class _DbAccessTokensProvider {
  constructor(options) {
    this.options = options;
    this.table = options.table || "auth_access_tokens";
    this.tokenSecretLength = options.tokenSecretLength || 40;
    this.type = options.type || "auth_token";
    this.prefix = options.prefix || "oat_";
  }
  /**
   * Create tokens provider instance for a given Lucid model
   */
  static forModel(model, options) {
    return new _DbAccessTokensProvider({ tokenableModel: model, ...options || {} });
  }
  /**
   * A unique type for the value. The type is used to identify a
   * bucket of tokens within the storage layer.
   *
   * Defaults to auth_token
   */
  type;
  /**
   * A unique prefix to append to the publicly shared token value.
   *
   * Defaults to oat
   */
  prefix;
  /**
   * Database table to use for querying access tokens
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
        `Cannot use "${model.name}" model for managing access tokens. The value of column "${model.primaryKey}" is undefined or null`
      );
    }
  }
  /**
   * Maps a database row to an instance token instance
   */
  dbRowToAccessToken(dbRow) {
    return new AccessToken({
      identifier: dbRow.id,
      tokenableId: dbRow.tokenable_id,
      type: dbRow.type,
      name: dbRow.name,
      hash: dbRow.hash,
      abilities: JSON.parse(dbRow.abilities),
      createdAt: typeof dbRow.created_at === "number" ? new Date(dbRow.created_at) : dbRow.created_at,
      updatedAt: typeof dbRow.updated_at === "number" ? new Date(dbRow.updated_at) : dbRow.updated_at,
      lastUsedAt: typeof dbRow.last_used_at === "number" ? new Date(dbRow.last_used_at) : dbRow.last_used_at,
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
  async create(user, abilities = ["*"], options) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const transientToken = AccessToken.createTransientToken(
      user.$primaryKeyValue,
      this.tokenSecretLength,
      options?.expiresIn || this.options.expiresIn
    );
    const dbRow = {
      tokenable_id: transientToken.userId,
      type: this.type,
      name: options?.name || null,
      hash: transientToken.hash,
      abilities: JSON.stringify(abilities),
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date(),
      last_used_at: null,
      expires_at: transientToken.expiresAt || null
    };
    const result = await queryClient.table(this.table).insert(dbRow).returning("id");
    const id = this.#isObject(result[0]) ? result[0].id : result[0];
    if (!id) {
      throw new RuntimeException2(
        `Cannot save access token. The result "${inspect(result)}" of insert query is unexpected`
      );
    }
    return new AccessToken({
      identifier: id,
      tokenableId: dbRow.tokenable_id,
      type: dbRow.type,
      prefix: this.prefix,
      secret: transientToken.secret,
      name: dbRow.name,
      hash: dbRow.hash,
      abilities: JSON.parse(dbRow.abilities),
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
      lastUsedAt: dbRow.last_used_at,
      expiresAt: dbRow.expires_at
    });
  }
  /**
   * Find a token for a user by the token id
   */
  async find(user, identifier) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const dbRow = await queryClient.query().from(this.table).where({ id: identifier, tokenable_id: user.$primaryKeyValue, type: this.type }).limit(1).first();
    if (!dbRow) {
      return null;
    }
    return this.dbRowToAccessToken(dbRow);
  }
  /**
   * Delete a token by its id
   */
  async delete(user, identifier) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const affectedRows = await queryClient.query().from(this.table).where({ id: identifier, tokenable_id: user.$primaryKeyValue, type: this.type }).del().exec();
    return affectedRows;
  }
  /**
   * Delete all tokens for a given user
   *
   * @param user - The user instance to delete tokens for
   *
   * @example
   * const deletedCount = await provider.deleteAll(user)
   * console.log('Deleted tokens:', deletedCount)
   */
  async deleteAll(user) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const affectedRows = await queryClient.query().from(this.table).where({ tokenable_id: user.$primaryKeyValue, type: this.type }).del().exec();
    return affectedRows;
  }
  /**
   * Returns all the tokens for a given user
   *
   * @param user - The user instance to get tokens for
   *
   * @example
   * const tokens = await provider.all(user)
   * console.log('User has', tokens.length, 'tokens')
   * tokens.forEach(token => console.log(token.name))
   */
  async all(user) {
    this.#ensureIsPersisted(user);
    const queryClient = await this.getDb();
    const dbRows = await queryClient.query().from(this.table).where({ tokenable_id: user.$primaryKeyValue, type: this.type }).ifDialect("postgres", (query) => {
      query.orderBy([
        {
          column: "last_used_at",
          order: "desc",
          nulls: "last"
        }
      ]);
    }).unlessDialect("postgres", (query) => {
      query.orderBy([
        {
          column: "last_used_at",
          order: "asc",
          nulls: "last"
        }
      ]);
    }).orderBy("id", "desc").exec();
    return dbRows.map((dbRow) => {
      return this.dbRowToAccessToken(dbRow);
    });
  }
  /**
   * Verifies a publicly shared access token and returns an
   * access token for it.
   *
   * Returns null when unable to verify the token or find it
   * inside the storage
   */
  async verify(tokenValue) {
    const decodedToken = AccessToken.decode(this.prefix, tokenValue.release());
    if (!decodedToken) {
      return null;
    }
    const db = await this.getDb();
    const dbRow = await db.query().from(this.table).where({ id: decodedToken.identifier, type: this.type }).limit(1).first();
    if (!dbRow) {
      return null;
    }
    dbRow.last_used_at = /* @__PURE__ */ new Date();
    await db.from(this.table).where({ id: dbRow.id, type: dbRow.type }).update({ last_used_at: dbRow.last_used_at });
    const accessToken = this.dbRowToAccessToken(dbRow);
    if (!accessToken.verify(decodedToken.secret) || accessToken.isExpired()) {
      return null;
    }
    return accessToken;
  }
  /**
   * Invalidates a token identified by its publicly shared token
   */
  async invalidate(tokenValue) {
    const decodedToken = AccessToken.decode(this.prefix, tokenValue.release());
    if (!decodedToken) {
      return false;
    }
    const db = await this.getDb();
    const deleteCount = await db.query().from(this.table).where({ id: decodedToken.identifier, type: this.type }).del().exec();
    return Boolean(deleteCount);
  }
};

// modules/access_tokens_guard/user_providers/lucid.ts
import { RuntimeException as RuntimeException3 } from "@adonisjs/core/exceptions";
var AccessTokensLucidUserProvider = class {
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
    if (!model[this.options.tokens]) {
      throw new RuntimeException3(
        `Cannot use "${model.name}" model for verifying access tokens. Make sure to assign a token provider to the model.`
      );
    }
    return model[this.options.tokens];
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
   * Create a token for a given user
   */
  async createToken(user, abilities, options) {
    const tokensProvider = await this.getTokensProvider();
    return tokensProvider.create(user, abilities, options);
  }
  /**
   * Invalidates a token identified by its publicly shared token
   */
  async invalidateToken(tokenValue) {
    const tokensProvider = await this.getTokensProvider();
    return tokensProvider.invalidate(tokenValue);
  }
  /**
   * Finds a user by the user id
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
   * Verifies a publicly shared access token and returns an
   * access token for it.
   */
  async verifyToken(tokenValue) {
    const tokensProvider = await this.getTokensProvider();
    return tokensProvider.verify(tokenValue);
  }
};

// modules/access_tokens_guard/define_config.ts
function tokensGuard(config) {
  return {
    async resolver(name, app) {
      const emitter = await app.container.make("emitter");
      const provider = "resolver" in config.provider ? await config.provider.resolver(app) : config.provider;
      return (ctx) => new AccessTokensGuard(name, ctx, emitter, provider);
    }
  };
}
function tokensUserProvider(config) {
  return new AccessTokensLucidUserProvider(config);
}
export {
  AccessToken,
  AccessTokensGuard,
  AccessTokensLucidUserProvider,
  DbAccessTokensProvider,
  tokensGuard,
  tokensUserProvider
};
