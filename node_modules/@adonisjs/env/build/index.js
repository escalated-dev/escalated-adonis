import {
  EnvLoader,
  __export,
  debug_default
} from "./chunk-VIQ26ZGM.js";

// src/env.ts
import { schema as envSchema } from "@poppinss/validator-lite";

// src/parser.ts
import dotenv from "dotenv";

// src/errors.ts
var errors_exports = {};
__export(errors_exports, {
  E_IDENTIFIER_ALREADY_DEFINED: () => E_IDENTIFIER_ALREADY_DEFINED,
  E_INVALID_ENV_VARIABLES: () => E_INVALID_ENV_VARIABLES
});
import { createError, Exception } from "@poppinss/utils";
var E_INVALID_ENV_VARIABLES = class EnvValidationException extends Exception {
  static message = "Validation failed for one or more environment variables";
  static code = "E_INVALID_ENV_VARIABLES";
  help = "";
};
var E_IDENTIFIER_ALREADY_DEFINED = createError(
  'The identifier "%s" is already defined',
  "E_IDENTIFIER_ALREADY_DEFINED",
  500
);

// src/parser.ts
var EnvParser = class _EnvParser {
  #envContents;
  #preferProcessEnv = true;
  static #identifiers = {};
  constructor(envContents, options) {
    if (options?.ignoreProcessEnv) {
      this.#preferProcessEnv = false;
    }
    this.#envContents = envContents;
  }
  /**
   * Define an identifier for any environment value. The callback is invoked
   * when the value match the identifier to modify its interpolation.
   *
   * @deprecated use `EnvParser.defineIdentifier` instead
   */
  static identifier(name, callback) {
    _EnvParser.defineIdentifier(name, callback);
  }
  /**
   * Define an identifier for any environment value. The callback is invoked
   * when the value match the identifier to modify its interpolation.
   */
  static defineIdentifier(name, callback) {
    if (this.#identifiers[name]) {
      throw new E_IDENTIFIER_ALREADY_DEFINED([name]);
    }
    this.#identifiers[name] = callback;
  }
  /**
   * Define an identifier for any environment value, if it's not already defined.
   * The callback is invoked when the value match the identifier to modify its
   * interpolation.
   */
  static defineIdentifierIfMissing(name, callback) {
    if (typeof this.#identifiers[name] === "undefined") {
      this.#identifiers[name] = callback;
    }
  }
  /**
   * Remove an identifier
   */
  static removeIdentifier(name) {
    delete this.#identifiers[name];
  }
  /**
   * Returns the value from the parsed object
   */
  #getValue(key, parsed) {
    if (this.#preferProcessEnv && process.env[key]) {
      return process.env[key];
    }
    if (parsed[key]) {
      return this.#interpolate(parsed[key], parsed);
    }
    return process.env[key] || "";
  }
  /**
   * Interpolating the token wrapped inside the mustache braces.
   */
  #interpolateMustache(token, parsed) {
    const closingBrace = token.indexOf("}");
    if (closingBrace === -1) {
      return token;
    }
    const varReference = token.slice(1, closingBrace).trim();
    return `${this.#getValue(varReference, parsed)}${token.slice(closingBrace + 1)}`;
  }
  /**
   * Interpolating the variable reference starting with a
   * `$`. We only capture numbers,letter and underscore.
   * For other characters, one can use the mustache
   * braces.
   */
  #interpolateVariable(token, parsed) {
    return token.replace(/[a-zA-Z0-9_]+/, (key) => {
      return this.#getValue(key, parsed);
    });
  }
  /**
   * Interpolates the referenced values
   */
  #interpolate(value, parsed) {
    const tokens = value.split("$");
    let newValue = "";
    let skipNextToken = true;
    tokens.forEach((token) => {
      if (token === "\\") {
        newValue += "$";
        skipNextToken = true;
        return;
      }
      if (skipNextToken) {
        newValue += token.replace(/\\$/, "$");
        if (token.endsWith("\\")) {
          return;
        }
      } else {
        if (token.startsWith("{")) {
          newValue += this.#interpolateMustache(token, parsed);
          return;
        }
        newValue += this.#interpolateVariable(token, parsed);
      }
      skipNextToken = false;
    });
    return newValue;
  }
  /**
   * Parse the env string to an object of environment variables.
   */
  async parse() {
    const envCollection = dotenv.parse(this.#envContents.trim());
    const identifiers = Object.keys(_EnvParser.#identifiers);
    let result = {};
    $keyLoop: for (const key in envCollection) {
      const value = this.#getValue(key, envCollection);
      if (value.includes(":")) {
        for (const identifier of identifiers) {
          if (value.startsWith(`${identifier}:`)) {
            result[key] = await _EnvParser.#identifiers[identifier](
              value.substring(identifier.length + 1)
            );
            continue $keyLoop;
          }
          if (value.startsWith(`${identifier}\\:`)) {
            result[key] = identifier + value.substring(identifier.length + 1);
            continue $keyLoop;
          }
        }
        result[key] = value;
      } else {
        result[key] = value;
      }
    }
    return result;
  }
};

// src/validator.ts
var EnvValidator = class {
  #schema;
  #error;
  constructor(schema) {
    this.#schema = schema;
    this.#error = new E_INVALID_ENV_VARIABLES();
  }
  /**
   * Accepts an object of values to validate against the pre-defined
   * schema.
   *
   * The return value is a merged copy of the original object and the
   * values mutated by the schema validator.
   */
  validate(values) {
    const help = [];
    const validated = Object.keys(this.#schema).reduce(
      (result, key) => {
        const value = process.env[key] || values[key];
        try {
          result[key] = this.#schema[key](key, value);
        } catch (error) {
          help.push(`- ${error.message}`);
        }
        return result;
      },
      { ...values }
    );
    if (help.length) {
      this.#error.help = help.join("\n");
      throw this.#error;
    }
    return validated;
  }
};

// src/processor.ts
var EnvProcessor = class {
  /**
   * App root is needed to load files
   */
  #appRoot;
  constructor(appRoot) {
    this.#appRoot = appRoot;
  }
  /**
   * Parse env variables from raw contents
   */
  async #processContents(envContents, store) {
    if (!envContents.trim()) {
      return store;
    }
    const parser = new EnvParser(envContents);
    const values = await parser.parse();
    Object.keys(values).forEach((key) => {
      let value = process.env[key];
      if (!value) {
        value = values[key];
        process.env[key] = values[key];
      }
      if (!store[key]) {
        store[key] = value;
      }
    });
    return store;
  }
  /**
   * Parse env variables by loading dot files.
   */
  async #loadAndProcessDotFiles() {
    const loader = new EnvLoader(this.#appRoot);
    const envFiles = await loader.load();
    if (debug_default.enabled) {
      debug_default(
        "processing .env files (priority from top to bottom) %O",
        envFiles.map((file) => file.path)
      );
    }
    const envValues = {};
    await Promise.all(envFiles.map(({ contents }) => this.#processContents(contents, envValues)));
    return envValues;
  }
  /**
   * Process env variables
   */
  async process() {
    return this.#loadAndProcessDotFiles();
  }
};

// src/env.ts
var Env = class _Env {
  /**
   * A cache of env values
   */
  #values;
  constructor(values) {
    this.#values = values;
  }
  /**
   * Create an instance of the env class by validating the
   * environment variables. Also, the `.env` files are
   * loaded from the appRoot
   */
  static async create(appRoot, schema) {
    const values = await new EnvProcessor(appRoot).process();
    const validator = this.rules(schema);
    return new _Env(validator.validate(values));
  }
  /**
   * Define an identifier for any environment value. The callback is invoked
   * when the value match the identifier to modify its interpolation.
   *
   * @deprecated use `Env.defineIdentifier` instead
   */
  static identifier(name, callback) {
    return EnvParser.defineIdentifier(name, callback);
  }
  /**
   * Define an identifier for any environment value. The callback is invoked
   * when the value match the identifier to modify its interpolation.
   */
  static defineIdentifier(name, callback) {
    EnvParser.defineIdentifier(name, callback);
  }
  /**
   * Define an identifier for any environment value, if it's not already defined.
   * The callback is invoked when the value match the identifier to modify its
   * interpolation.
   */
  static defineIdentifierIfMissing(name, callback) {
    EnvParser.defineIdentifierIfMissing(name, callback);
  }
  /**
   * Remove an identifier
   */
  static removeIdentifier(name) {
    EnvParser.removeIdentifier(name);
  }
  /**
   * The schema builder for defining validation rules
   */
  static schema = envSchema;
  /**
   * Define the validation rules for validating environment
   * variables. The return value is an instance of the
   * env validator
   */
  static rules(schema) {
    const validator = new EnvValidator(schema);
    return validator;
  }
  get(key, defaultValue) {
    if (this.#values[key] !== void 0) {
      return this.#values[key];
    }
    const envValue = process.env[key];
    if (envValue) {
      return envValue;
    }
    return defaultValue;
  }
  set(key, value) {
    this.#values[key] = value;
    process.env[key] = value;
  }
};
export {
  Env,
  EnvLoader,
  EnvParser,
  EnvProcessor,
  errors_exports as errors
};
//# sourceMappingURL=index.js.map