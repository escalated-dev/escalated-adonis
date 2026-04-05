import {
  __export,
  debug_default
} from "./chunk-OVQD25FW.js";

// src/errors.ts
var errors_exports = {};
__export(errors_exports, {
  E_INVALID_PRELOAD_FILE: () => E_INVALID_PRELOAD_FILE,
  E_INVALID_PROVIDER: () => E_INVALID_PROVIDER,
  E_MISSING_ASSEMBLER_RUNNER_COMMAND: () => E_MISSING_ASSEMBLER_RUNNER_COMMAND,
  E_MISSING_ASSEMBLER_RUNNER_NAME: () => E_MISSING_ASSEMBLER_RUNNER_NAME,
  E_MISSING_BUNDLER_BUILD_COMMAND: () => E_MISSING_BUNDLER_BUILD_COMMAND,
  E_MISSING_BUNDLER_DEV_COMMAND: () => E_MISSING_BUNDLER_DEV_COMMAND,
  E_MISSING_BUNDLER_NAME: () => E_MISSING_BUNDLER_NAME,
  E_MISSING_METAFILE_PATTERN: () => E_MISSING_METAFILE_PATTERN,
  E_MISSING_PRELOAD_FILE: () => E_MISSING_PRELOAD_FILE,
  E_MISSING_PROVIDER_FILE: () => E_MISSING_PROVIDER_FILE,
  E_MISSING_SUITE_FILES: () => E_MISSING_SUITE_FILES,
  E_MISSING_SUITE_NAME: () => E_MISSING_SUITE_NAME
});
import { createError } from "@poppinss/utils";
var E_MISSING_METAFILE_PATTERN = createError(
  'Invalid metafile entry "%s". Missing pattern property',
  "E_MISSING_METAFILE_PATTERN"
);
var E_MISSING_PRELOAD_FILE = createError(
  'Invalid preload entry "%s". Missing file property',
  "E_MISSING_PRELOAD_FILE"
);
var E_INVALID_PRELOAD_FILE = createError(
  'Invalid preload entry "%s". The file property must be a function',
  "E_INVALID_PRELOAD_FILE"
);
var E_MISSING_PROVIDER_FILE = createError(
  'Invalid provider entry "%s". Missing file property',
  "E_MISSING_PROVIDER_FILE"
);
var E_INVALID_PROVIDER = createError(
  'Invalid provider entry "%s". The file property must be a function',
  "E_INVALID_PROVIDER"
);
var E_MISSING_SUITE_NAME = createError(
  'Invalid suite entry "%s". Missing name property',
  "E_MISSING_SUITE_NAME"
);
var E_MISSING_SUITE_FILES = createError(
  'Invalid suite entry "%s". Missing files property',
  "E_MISSING_SUITE_FILES"
);
var E_MISSING_BUNDLER_DEV_COMMAND = createError(
  "Invalid assetsBundler entry. Missing devServer property",
  "E_MISSING_BUNDLER_DEV_COMMAND"
);
var E_MISSING_BUNDLER_BUILD_COMMAND = createError(
  "Invalid assetsBundler entry. Missing build property",
  "E_MISSING_BUNDLER_BUILD_COMMAND"
);
var E_MISSING_BUNDLER_NAME = createError(
  "Invalid assetsBundler entry. Missing name property",
  "E_MISSING_BUNDLER_NAME"
);
var E_MISSING_ASSEMBLER_RUNNER_NAME = createError(
  "Invalid assembler.runner entry. Missing name property",
  "E_MISSING_ASSEMBLER_RUNNER_NAME"
);
var E_MISSING_ASSEMBLER_RUNNER_COMMAND = createError(
  "Invalid assembler.runner entry. Missing command property",
  "E_MISSING_ASSEMBLER_RUNNER_COMMAND"
);

// src/generators.ts
import { slash } from "@poppinss/utils";
import { extname, join } from "path";
import string from "@poppinss/utils/string";
import StringBuilder from "@poppinss/utils/string_builder";
var generators = {
  /**
   * The given controller names will always be generated
   * in singular form
   */
  singularControllerNames: [
    "home",
    "admin",
    "session",
    "application",
    "money",
    "signup",
    "login",
    "auth",
    "authentication",
    "adonis",
    "adonisjs",
    "dashboard",
    "api",
    "about",
    "conatact",
    "blog"
  ],
  /**
   * Creates the entity path and name from the user
   * input.
   */
  createEntity(entityName) {
    entityName = entityName.replace(new RegExp(`${extname(entityName)}$`), "");
    const parts = entityName.split("/");
    const [name] = parts.splice(-1);
    if (parts.length) {
      return {
        path: parts.join("/"),
        name
      };
    }
    return {
      path: "./",
      name
    };
  },
  /**
   * Construct paths to make an import path
   */
  importPath(...paths) {
    return slash(join(...paths));
  },
  /**
   * Converts an entity name to database table name
   */
  tableName(entityName) {
    return new StringBuilder(
      this.modelName(new StringBuilder(entityName).removeSuffix("table").toString())
    ).plural().snakeCase().toString();
  },
  /**
   * Converts an entity name to model name
   */
  modelName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("model").singular().pascalCase().toString();
  },
  /**
   * Converts an entity name to model file name
   */
  modelFileName(entityName) {
    return new StringBuilder(this.modelName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to a controller name
   */
  controllerName(entityName, singular = false) {
    const controller = new StringBuilder(entityName).removeExtension().removeSuffix("controller");
    if (this.singularControllerNames.includes(controller.toString().toLowerCase())) {
      controller.singular();
    } else if (singular) {
      controller.singular();
    } else {
      controller.plural();
    }
    return controller.pascalCase().suffix("Controller").toString();
  },
  /**
   * Converts an entity name to a controller file name
   */
  controllerFileName(entityName, singular = false) {
    return new StringBuilder(this.controllerName(entityName, singular)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to an event name
   */
  eventName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("event").pascalCase().toString();
  },
  /**
   * Converts an entity name to an event file name
   */
  eventFileName(entityName) {
    return new StringBuilder(this.eventName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to listener name
   */
  listenerName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("listener").pascalCase().toString();
  },
  /**
   * Converts an entity name to listener file name
   */
  listenerFileName(entityName) {
    return new StringBuilder(this.listenerName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to middleware name
   */
  middlewareName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("middleware").pascalCase().suffix("Middleware").toString();
  },
  /**
   * Converts an entity name to middleware file name
   */
  middlewareFileName(entityName) {
    return new StringBuilder(this.middlewareName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to provider name
   */
  providerName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("provider").singular().pascalCase().suffix("Provider").toString();
  },
  /**
   * Converts an entity name to provider file name
   */
  providerFileName(entityName) {
    return new StringBuilder(this.providerName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to policy name
   */
  policyName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("policy").removeSuffix("model").singular().pascalCase().suffix("Policy").toString();
  },
  /**
   * Converts an entity name to policy file name
   */
  policyFileName(entityName) {
    return new StringBuilder(this.policyName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to factory name
   */
  factoryName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("factory").removeSuffix("model").singular().pascalCase().suffix("Factory").toString();
  },
  /**
   * Converts an entity name to factory file name
   */
  factoryFileName(entityName) {
    return new StringBuilder(this.factoryName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to service name
   */
  serviceName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("service").removeSuffix("model").singular().pascalCase().suffix("Service").toString();
  },
  /**
   * Converts an entity name to service file name
   */
  serviceFileName(entityName) {
    return new StringBuilder(this.serviceName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to seeder name
   */
  seederName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("seeder").removeSuffix("model").singular().pascalCase().suffix("Seeder").toString();
  },
  /**
   * Converts an entity name to seeder file name
   */
  seederFileName(entityName) {
    return new StringBuilder(this.seederName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to command terminal name
   */
  commandTerminalName(entityName) {
    const dashCase = new StringBuilder(this.commandName(entityName)).dashCase().toString();
    const [namespace, ...rest] = dashCase.split("-");
    if (!rest.length) {
      return namespace;
    }
    return `${namespace}:${rest.join("-")}`;
  },
  /**
   * Converts an entity name to command name
   */
  commandName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("command").pascalCase().toString();
  },
  /**
   * Converts an entity name to command file name
   */
  commandFileName(entityName) {
    return new StringBuilder(this.commandName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to validator name
   */
  validatorName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("validator").singular().pascalCase().toString();
  },
  /**
   * Converts an entity name to validator action
   * name
   */
  validatorActionName(entityName, action) {
    return new StringBuilder(this.validatorName(entityName)).prefix(`${action}_`).suffix("_validator").camelCase().toString();
  },
  /**
   * Converts an entity name to validator file name
   */
  validatorFileName(entityName) {
    return new StringBuilder(this.validatorName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to exception name
   */
  exceptionName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix("exception").pascalCase().suffix("Exception").toString();
  },
  /**
   * Converts an entity name to exception file name
   */
  exceptionFileName(entityName) {
    return new StringBuilder(this.exceptionName(entityName)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to mailer name
   */
  mailerName(entityName, type = "notification") {
    return new StringBuilder(entityName).removeExtension().removeSuffix("notification").removeSuffix("provision").removeSuffix("mailer").pascalCase().suffix(string.pascalCase(type)).toString();
  },
  /**
   * Converts an entity name to mailer file name
   */
  mailerFileName(entityName, type = "notification") {
    return new StringBuilder(this.mailerName(entityName, type)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity name to class-based mail name
   */
  mailName(entityName, type = "notification") {
    return new StringBuilder(entityName).removeExtension().removeSuffix(type).removeSuffix("mailer", { similarWords: ["emailer"] }).removeSuffix("mail", { similarWords: ["email"] }).pascalCase().suffix(string.pascalCase(type)).toString();
  },
  /**
   * Converts an entity name to class-name mail filename
   */
  mailFileName(entityName, type = "notification") {
    return new StringBuilder(this.mailName(entityName, type)).snakeCase().ext(".ts").toString();
  },
  /**
   * Converts an entity to test group name
   */
  testGroupName(entity) {
    return new StringBuilder(`${entity.path}/${entity.name}`).removeExtension().removeSuffix(".spec").sentenceCase().toString();
  },
  /**
   * Converts an entity name to test file name
   */
  testFileName(entityName) {
    return new StringBuilder(entityName).removeExtension().removeSuffix(".spec").snakeCase().ext(".spec.ts").toString();
  },
  /**
   * Converts an entity name to the view template file
   */
  viewFileName(entityName) {
    return new StringBuilder(entityName).removeExtension().snakeCase().ext(".edge").toString();
  }
};
var generators_default = generators;

// src/rc_file/parser.ts
import { inspect } from "util";
import globParent from "glob-parent";
import { ObjectBuilder } from "@poppinss/utils";

// src/directories.ts
var directories = {
  config: "config",
  commands: "commands",
  contracts: "contracts",
  public: "public",
  providers: "providers",
  languageFiles: "resources/lang",
  migrations: "database/migrations",
  seeders: "database/seeders",
  factories: "database/factories",
  views: "resources/views",
  start: "start",
  tmp: "tmp",
  tests: "tests",
  httpControllers: "app/controllers",
  models: "app/models",
  services: "app/services",
  exceptions: "app/exceptions",
  mailers: "app/mailers",
  mails: "app/mails",
  middleware: "app/middleware",
  policies: "app/policies",
  validators: "app/validators",
  events: "app/events",
  listeners: "app/listeners",
  stubs: "stubs"
};

// src/rc_file/parser.ts
var RcFileParser = class {
  /**
   * Defaults for the RcFile. This object initiates all
   * the known properties
   */
  #defaults = {
    typescript: true,
    preloads: [],
    metaFiles: [],
    commandsAliases: {},
    commands: [],
    providers: [],
    directories,
    tests: {
      suites: [],
      timeout: 2e3,
      forceExit: true
    },
    raw: {},
    experimental: {}
  };
  /**
   * RcFile merged with defaults
   */
  #rcFile;
  constructor(rcFile) {
    this.#rcFile = Object.assign(this.#defaults, rcFile);
    this.#rcFile.raw = rcFile;
  }
  /**
   * An array of known environments
   */
  #knownEnvironments() {
    return ["web", "console", "test", "repl"];
  }
  /**
   * Returns the assets bundler object
   */
  #getAssetsBundler() {
    if (this.#rcFile.assetsBundler === false) {
      return false;
    }
    if (!this.#rcFile.assetsBundler) {
      return;
    }
    if (!this.#rcFile.assetsBundler.name) {
      throw new E_MISSING_BUNDLER_NAME();
    }
    if (!this.#rcFile.assetsBundler.devServer) {
      throw new E_MISSING_BUNDLER_DEV_COMMAND();
    }
    if (!this.#rcFile.assetsBundler.build) {
      throw new E_MISSING_BUNDLER_BUILD_COMMAND();
    }
    return {
      name: this.#rcFile.assetsBundler.name,
      devServer: this.#rcFile.assetsBundler.devServer,
      build: this.#rcFile.assetsBundler.build
    };
  }
  /**
   * Returns the assembler object
   */
  #getHooks() {
    const hooksProperty = this.#rcFile.hooks || this.#rcFile.unstable_assembler;
    if (!hooksProperty) {
      return;
    }
    return new ObjectBuilder({}).add("onBuildStarting", hooksProperty.onBuildStarting).add("onBuildCompleted", hooksProperty.onBuildCompleted).add("onDevServerStarted", hooksProperty.onDevServerStarted).add("onSourceFileChanged", hooksProperty.onSourceFileChanged).toObject();
  }
  /**
   * Returns a normalized array of preload files
   */
  #getPreloads() {
    return this.#rcFile.preloads.map((preload) => {
      const normalizedPreload = typeof preload === "function" ? {
        file: preload,
        environment: this.#knownEnvironments()
      } : preload;
      if (!normalizedPreload.file) {
        throw new E_MISSING_PRELOAD_FILE([inspect(preload)]);
      }
      if (typeof normalizedPreload.file !== "function") {
        throw new E_INVALID_PRELOAD_FILE([inspect(preload)]);
      }
      return {
        file: normalizedPreload.file,
        environment: normalizedPreload.environment ?? this.#knownEnvironments()
      };
    });
  }
  /**
   * Returns a normalized array of providers
   */
  #getProviders() {
    return this.#rcFile.providers.map((provider) => {
      const normalizedProvider = typeof provider === "function" ? {
        file: provider,
        environment: this.#knownEnvironments()
      } : provider;
      if (!normalizedProvider.file) {
        throw new E_MISSING_PROVIDER_FILE([inspect(provider)]);
      }
      if (typeof normalizedProvider.file !== "function") {
        throw new E_INVALID_PROVIDER([inspect(provider)]);
      }
      return {
        file: normalizedProvider.file,
        environment: normalizedProvider.environment ?? this.#knownEnvironments()
      };
    });
  }
  /**
   * Returns a nornalized array of meta files
   */
  #getMetaFiles() {
    return this.#rcFile.metaFiles.map((pattern) => {
      const normalizeMetaFile = typeof pattern === "string" ? {
        pattern,
        reloadServer: true
      } : pattern;
      if (!normalizeMetaFile.pattern) {
        throw new E_MISSING_METAFILE_PATTERN([inspect(pattern)]);
      }
      return {
        pattern: normalizeMetaFile.pattern,
        reloadServer: normalizeMetaFile.reloadServer ?? true
      };
    });
  }
  /**
   * Returns a normalized array of test suites
   */
  #getSuites() {
    const suites = this.#rcFile.tests.suites || [];
    return suites.map((suite) => {
      if (!suite.name) {
        throw new E_MISSING_SUITE_NAME([inspect(suite)]);
      }
      if (!suite.files) {
        throw new E_MISSING_SUITE_FILES([inspect(suite)]);
      }
      const files = Array.isArray(suite.files) ? [...suite.files] : [suite.files];
      return {
        name: suite.name,
        files,
        directories: files.map((file) => globParent(file)),
        timeout: suite.timeout
      };
    });
  }
  /**
   * Parse and validate file contents and merge them with defaults
   */
  parse() {
    const assembler = this.#getHooks();
    const assetsBundler = this.#getAssetsBundler();
    return {
      typescript: this.#rcFile.typescript,
      ...assembler ? { hooks: assembler } : {},
      ...assetsBundler !== void 0 ? { assetsBundler } : {},
      preloads: this.#getPreloads(),
      metaFiles: this.#getMetaFiles(),
      commands: [...this.#rcFile.commands],
      directories: { ...directories, ...this.#rcFile.directories },
      commandsAliases: { ...this.#rcFile.commandsAliases },
      providers: this.#getProviders(),
      tests: {
        suites: this.#getSuites(),
        timeout: this.#rcFile.tests.timeout ?? 2e3,
        forceExit: this.#rcFile.tests.forceExit ?? true
      },
      experimental: this.#rcFile.experimental,
      raw: this.#rcFile.raw
    };
  }
};

// src/feature_flags.ts
var FeatureFlags = class {
  #flags;
  #flagsFactory;
  constructor(flags) {
    if (typeof flags === "function") {
      this.#flagsFactory = flags;
    } else {
      this.#flags = flags;
    }
  }
  enabled(feature) {
    const flags = this.#flags ?? this.#flagsFactory();
    return flags[feature] === true;
  }
  disabled(feature) {
    const flags = this.#flags ?? this.#flagsFactory();
    return flags[feature] === false;
  }
  has(feature) {
    const flags = this.#flags ?? this.#flagsFactory();
    return feature in flags;
  }
  when(feature, enabledCallback, disabledCallback) {
    if (this.enabled(feature)) {
      return enabledCallback();
    }
    return disabledCallback ? disabledCallback() : void 0;
  }
};

// src/application.ts
import Hooks from "@poppinss/hooks";
import { fileURLToPath } from "url";
import { join as join2, relative } from "path";
import { Container } from "@adonisjs/fold";
import Macroable from "@poppinss/macroable";
import { importDefault, RuntimeException as RuntimeException2 } from "@poppinss/utils";

// src/managers/config.ts
import { Config, ConfigLoader } from "@adonisjs/config";
var ConfigManager = class {
  #appRoot;
  /**
   * Config tree set explicitly
   */
  #configValues;
  /**
   * Reference to the config class. The value is defined
   * after the "init" method call
   */
  config;
  constructor(appRoot) {
    this.#appRoot = appRoot;
  }
  /**
   * Define the config values to use when booting the
   * config provider. Calling this method disables
   * reading files from the config directory.
   */
  useConfig(values) {
    this.#configValues = values;
    return this;
  }
  /**
   * Process config values.
   */
  async process(configDirectory) {
    if (this.#configValues) {
      this.config = new Config(this.#configValues);
    } else {
      const loader = new ConfigLoader(new URL(configDirectory, this.#appRoot));
      debug_default('loading config from directory "%s"', configDirectory);
      this.config = new Config(await loader.load());
    }
    this.#configValues = void 0;
  }
};

// src/managers/rc_file.ts
var RcFileManager = class {
  #appRoot;
  /**
   * RcFile contents set explicitly
   */
  #rcContents;
  /**
   * Reference to the parsed rc file. The value is defined
   * after the "init" method call
   */
  rcFile;
  constructor(appRoot) {
    this.#appRoot = appRoot;
  }
  /**
   * Specify the contents of the "adonisrc.js" file as
   * an object. Calling this method will disable loading
   * the "adonisrc.js" file from the disk.
   */
  rcContents(value) {
    this.#rcContents = value;
    return this;
  }
  /**
   * Process the contents for the rcFile
   */
  async process() {
    if (!this.#rcContents) {
      const rcTSFile = new URL("adonisrc.js", this.#appRoot);
      try {
        const rcExports = await import(rcTSFile.href);
        this.#rcContents = rcExports.default;
        debug_default("adonisrc.ts file contents: %O", this.#rcContents);
      } catch (error) {
        if (!/Cannot find module/.test(error.message)) {
          throw error;
        }
      }
    }
    this.rcFile = new RcFileParser(this.#rcContents).parse();
    this.#rcContents = void 0;
  }
};

// src/managers/node_env.ts
var TEST_ENVS = ["test", "testing"];
var PROD_ENVS = ["prod", "production"];
var DEV_ENVS = ["dev", "develop", "development"];
var NodeEnvManager = class {
  nodeEnvironment = "unknown";
  /**
   * Normalizes node env
   */
  #normalizeNodeEnv(env) {
    if (!env || typeof env !== "string") {
      return "unknown";
    }
    env = env.toLowerCase();
    if (DEV_ENVS.includes(env)) {
      return "development";
    }
    if (PROD_ENVS.includes(env)) {
      return "production";
    }
    if (TEST_ENVS.includes(env)) {
      return "test";
    }
    return env;
  }
  /**
   * Capture the current node env
   */
  process() {
    this.nodeEnvironment = this.#normalizeNodeEnv(process.env.NODE_ENV);
  }
};

// src/managers/preloads.ts
var PreloadsManager = class {
  /**
   * List of registered preloads
   */
  #list = [];
  /**
   * The options accepted by the manager.
   */
  #options;
  constructor(options) {
    this.#options = options;
  }
  /**
   * Filters the preload modules by the current environment.
   */
  #filterByEnvironment(provider) {
    if (this.#options.environment === "unknown") {
      return false;
    }
    return provider.environment.includes(this.#options.environment);
  }
  /**
   * Pass an array of preload modules to import
   */
  use(list) {
    this.#list = list;
    return this;
  }
  /**
   * Switch the environment in which the app is running.
   */
  setEnvironment(environment) {
    debug_default(
      'switching environment for preloads { from:"%s", to: "%s" }',
      this.#options.environment,
      environment
    );
    this.#options.environment = environment;
    return this;
  }
  /**
   * Import preload files
   */
  async import() {
    const preloads = this.#list.filter((preload) => this.#filterByEnvironment(preload));
    debug_default("preloading modules %O", preloads);
    await Promise.all(preloads.map((preload) => preload.file()));
    this.#list = [];
  }
};

// src/managers/providers.ts
import { RuntimeException } from "@poppinss/utils";
var ProvidersManager = class {
  /**
   * An array of collected providers
   */
  #providers = [];
  /**
   * An array of providers with the `shutdown` method. We release the
   * values from the providers array and only keep the once with
   * shutdown method
   */
  #providersWithShutdownListeners = [];
  /**
   * An array of providers modules picked from the ".adonisrc.ts"
   * file.
   */
  #list = [];
  /**
   * The options accepted by the manager
   */
  #options;
  constructor(options) {
    this.#options = options;
  }
  /**
   * Filters the providers by the current environment.
   */
  #filterByEnvironment(provider) {
    if (this.#options.environment === "unknown") {
      return false;
    }
    return provider.environment.includes(this.#options.environment);
  }
  /**
   * Check if value is a class
   */
  #isAClass(providerClass) {
    return typeof providerClass === "function" && providerClass.toString().startsWith("class ");
  }
  /**
   * Imports all providers from the registered module path. The method relies
   * on --experimental-import-meta-resolve flag to resolve paths from
   * the app root.
   */
  async #resolveProvider(provider) {
    const providerExports = await provider.file();
    const exportsLength = Object.keys(providerExports).length;
    if (exportsLength === 0) {
      return null;
    }
    if (!providerExports.default) {
      throw new RuntimeException(
        `Invalid exports from "${provider.file.toString()}" provider. It must have a default export`
      );
    }
    if (!this.#isAClass(providerExports.default)) {
      throw new RuntimeException(
        `Default export from module "${provider.file.toString()}" is not a class`
      );
    }
    return providerExports.default;
  }
  /**
   * Resolves all providers from the supplied list of module paths.
   */
  #resolve() {
    const providers = this.#list.filter((provider) => this.#filterByEnvironment(provider));
    debug_default("loading providers %O", providers);
    return Promise.all(providers.map((provider) => this.#resolveProvider(provider)));
  }
  /**
   * Pass an array of providers to use
   */
  use(list) {
    this.#list = list;
    return this;
  }
  /**
   * Switch the environment in which the app is running.
   */
  setEnvironment(environment) {
    debug_default(
      'switching environment for providers { from:"%s", to: "%s" }',
      this.#options.environment,
      environment
    );
    this.#options.environment = environment;
    return this;
  }
  /**
   * Invoke register method on the providers.
   */
  async register() {
    const providers = await this.#resolve();
    this.#list = [];
    providers.forEach((provider) => {
      if (provider) {
        const providerInstance = new provider(...this.#options.providersState);
        this.#providers.push(providerInstance);
        if (providerInstance.shutdown) {
          this.#providersWithShutdownListeners.push(providerInstance);
        }
        if (providerInstance.register) {
          providerInstance.register();
        }
      }
    });
  }
  /**
   * Invoke boot method on the providers. The existing providers
   * instances are used.
   */
  async boot() {
    for (let provider of this.#providers) {
      if (provider.boot) {
        await provider.boot();
      }
    }
  }
  /**
   * Invoke start method on all the providers
   */
  async start() {
    for (let provider of this.#providers) {
      if (provider.start) {
        await provider.start();
      }
    }
  }
  /**
   * Invoke ready method on all the providers
   */
  async ready() {
    for (let provider of this.#providers) {
      if (provider.ready) {
        await provider.ready();
      }
    }
    this.#providers = [];
  }
  /**
   * Invoke shutdown method on all the providers
   */
  async shutdown(inReverseOrder) {
    const providersWithShutdownListeners = inReverseOrder ? Array.from(this.#providersWithShutdownListeners).reverse() : Array.from(this.#providersWithShutdownListeners);
    this.#providersWithShutdownListeners = [];
    for (let provider of providersWithShutdownListeners) {
      if (provider.shutdown) {
        await provider.shutdown();
      }
    }
  }
};

// src/application.ts
var Application = class extends Macroable {
  /**
   * Importer function to import modules from the application
   * context
   */
  #importer;
  /**
   * Flag to know if we have started the termination
   * process
   */
  #terminating = false;
  /**
   * The environment in which the app is running. Currently we track
   * pm2 only
   */
  #surroundedEnvironment = {
    pm2: false
  };
  /**
   * Application root. The path must end with '/'
   */
  #appRoot;
  /**
   * Current application environment
   */
  #environment;
  /**
   * Current state of the application
   */
  #state = "created";
  /**
   * Managers for sub-features
   */
  #configManager;
  #rcFileManager;
  #nodeEnvManager;
  #preloadsManager;
  #providersManager;
  /**
   * Lifecycle hooks
   */
  #hooks = new Hooks();
  /**
   * Store info metadata about the app.
   */
  info = /* @__PURE__ */ new Map();
  /**
   * Returns the application name from the info map
   */
  get appName() {
    return this.info.get("appName") || "adonisjs_app";
  }
  /**
   * Returns the application version from the info map
   */
  get version() {
    return this.info.get("version") || null;
  }
  /**
   * The parsed version for the "@adonisjs/core" package.
   */
  get adonisVersion() {
    return this.info.get("adonisVersion") || null;
  }
  /**
   * The URL for the root of the application
   */
  get appRoot() {
    return this.#appRoot;
  }
  /**
   * A boolean to know if the application has been booted
   */
  get isBooted() {
    return this.#state !== "created" && this.#state !== "initiated";
  }
  /**
   * A boolean to know if the application is ready
   */
  get isReady() {
    return this.#state === "ready";
  }
  /**
   * A boolean to know if the application has been terminated
   */
  get isTerminated() {
    return this.#state === "terminated";
  }
  /**
   * A boolean to know if the application is in the middle of getting
   * terminating
   */
  get isTerminating() {
    return this.#terminating && this.#state !== "terminated";
  }
  /**
   * Reference to the config class. The value is defined
   * after the "init" method call
   */
  get config() {
    return this.#configManager.config;
  }
  /**
   * Reference to the parsed rc file. The value is defined
   * after the "init" method call
   */
  get rcFile() {
    return this.#rcFileManager.rcFile;
  }
  /**
   * Normalized current NODE_ENV
   */
  get nodeEnvironment() {
    return this.#nodeEnvManager.nodeEnvironment;
  }
  /**
   * Return true when `this.nodeEnvironment === 'production'`
   */
  get inProduction() {
    return this.nodeEnvironment === "production";
  }
  /**
   * Return true when `this.nodeEnvironment === 'development'`
   */
  get inDev() {
    return this.nodeEnvironment === "development";
  }
  /**
   * Returns true when `this.nodeEnvironment === 'test'`
   */
  get inTest() {
    return this.nodeEnvironment === "test";
  }
  /**
   * Find if the process is managed and run under
   * pm2
   */
  get managedByPm2() {
    return this.#surroundedEnvironment.pm2;
  }
  /**
   * Reference to scaffolding generators
   */
  get generators() {
    return generators_default;
  }
  /**
   * Reference to the stubs module to scaffold
   * resources or eject stubs
   */
  stubs = {
    create: async () => {
      const { StubsManager } = await import("./manager-OLS5T3G7.js");
      return new StubsManager(this, this.makePath(this.rcFile.directories.stubs));
    }
  };
  /**
   * Check the status of the configured feature flags and act on them
   */
  experimentalFlags = new FeatureFlags(
    () => this.#rcFileManager.rcFile.experimental
  );
  /**
   * A flag to know if VineJS provider is configured. When set
   * to true, you may import `@vinejs/vine` package
   */
  usingVineJS = false;
  /**
   * A flag to know if Edge provider is configured. When set
   * to true, you may import `edge.js` package
   */
  usingEdgeJS = false;
  constructor(appRoot, options) {
    super();
    this.#appRoot = appRoot;
    this.#importer = options.importer;
    this.#environment = options.environment;
    this.#nodeEnvManager = new NodeEnvManager();
    this.#configManager = new ConfigManager(this.appRoot);
    this.#rcFileManager = new RcFileManager(this.appRoot);
    this.#providersManager = new ProvidersManager({
      environment: this.#environment,
      providersState: [this]
    });
    this.#preloadsManager = new PreloadsManager({
      environment: this.#environment
    });
    this.#surroundedEnvironment.pm2 = !!process.env.pm2_id;
    if (debug_default.enabled) {
      debug_default("app environment :%O", {
        pm2: this.#surroundedEnvironment.pm2,
        environment: this.#environment,
        nodeEnv: this.#nodeEnvManager.nodeEnvironment
      });
    }
  }
  /**
   * Instantiate the application container
   */
  #instantiateContainer() {
    this.container = new Container();
  }
  /**
   * The current environment in which the application
   * is running
   */
  getEnvironment() {
    return this.#environment;
  }
  /**
   * Switch the environment in which the app is running. The
   * environment can only be changed before the app is
   * booted.
   */
  setEnvironment(environment) {
    if (this.#state !== "created" && this.#state !== "initiated") {
      throw new RuntimeException2("Cannot switch environment once the app has been booted");
    }
    debug_default('switching environment { from:"%s", to: "%s" }', this.#environment, environment);
    this.#environment = environment;
    this.#preloadsManager.setEnvironment(environment);
    this.#providersManager.setEnvironment(environment);
    return this;
  }
  /**
   * The current state of the application.
   */
  getState() {
    return this.#state;
  }
  /**
   * Specify the contents of the "adonisrc.js" file as
   * an object. Calling this method will disable loading
   * the "adonisrc.js" file from the disk.
   */
  rcContents(value) {
    this.#rcFileManager.rcContents(value);
    return this;
  }
  /**
   * Define the config values to use when booting the
   * config provider. Calling this method disables
   * reading files from the config directory.
   */
  useConfig(values) {
    this.#configManager.useConfig(values);
    return this;
  }
  /**
   * Notify the parent process when the Node.js process is spawned with an IPC channel.
   * The arguments accepted are same as "process.send"
   */
  notify(message, sendHandle, options, callback) {
    if (process.send) {
      process.send(message, sendHandle, options, callback);
    }
  }
  /**
   * Listen for a process signal. This method is same as calling
   * "process.on(signal)"
   */
  listen(signal, callback) {
    process.on(signal, callback);
    return this;
  }
  /**
   * Listen for a process signal once. This method is same as calling
   * "process.once(signal)"
   */
  listenOnce(signal, callback) {
    process.once(signal, callback);
    return this;
  }
  /**
   * Listen for a process signal conditionally.
   */
  listenIf(conditional, signal, callback) {
    if (conditional) {
      process.on(signal, callback);
    }
    return this;
  }
  /**
   * Listen for a process signal once conditionally.
   */
  listenOnceIf(conditional, signal, callback) {
    if (conditional) {
      process.once(signal, callback);
    }
    return this;
  }
  /**
   * Register hooks that are called before the app starts
   * the initiating process
   */
  initiating(handler) {
    this.#hooks.add("initiating", handler);
    return this;
  }
  /**
   * Initiate the application. Calling this method performs following
   * operations.
   *
   * - Parses the "adonisrc.js" file
   * - Validate and set environment variables
   * - Loads the application config from the configured config dir.
   * - Configures the logger
   * - Instantiates the IoC container
   */
  async init() {
    if (this.#state !== "created") {
      debug_default('cannot initiate app from state "%s"', this.#state);
      return;
    }
    debug_default("initiating app");
    this.#instantiateContainer();
    await this.#hooks.runner("initiating").run(this);
    await this.#rcFileManager.process();
    this.#hooks.clear("initiating");
    this.#state = "initiated";
  }
  /**
   * Register hooks that are called before the app boot
   * process starts
   */
  booting(handler) {
    this.#hooks.add("booting", handler);
    return this;
  }
  /**
   * Boot the application. Calling this method performs the following
   * operations.
   *
   * - Resolve providers and call the "register" method on them.
   * - Call the "boot" method on providers
   * - Run the "booted" hooks
   */
  async boot() {
    if (this.#state !== "initiated") {
      debug_default('cannot boot app from state "%s"', this.#state);
      return;
    }
    debug_default("booting app");
    await this.#hooks.runner("booting").run(this);
    this.#hooks.clear("booting");
    this.#nodeEnvManager.process();
    await this.#configManager.process(this.rcFile.directories.config);
    this.#providersManager.use(this.rcFile.providers);
    await this.#providersManager.register();
    await this.#providersManager.boot();
    await this.#hooks.runner("booted").run(this);
    this.#hooks.clear("booted");
    this.#state = "booted";
  }
  /**
   * Register a hook to get notified when the application has
   * been booted.
   *
   * The hook will be called immediately if the app has already
   * been booted.
   */
  async booted(handler) {
    if (this.isBooted) {
      await handler(this);
    } else {
      this.#hooks.add("booted", handler);
    }
  }
  /**
   * Register hooks that are called when the app is starting
   */
  starting(handler) {
    this.#hooks.add("starting", handler);
    return this;
  }
  /**
   * Start the application. Calling this method performs the following
   * operations.
   *
   * - Run the "start" lifecycle hooks on all the providers
   * - Start the application by invoking the supplied callback
   * - Run the "ready" lifecycle hooks on all the providers
   * - Run the "ready" application hooks
   */
  async start(callback) {
    if (this.#state !== "booted") {
      debug_default('cannot start app from state "%s"', this.#state);
      return;
    }
    debug_default("starting app");
    await this.#providersManager.start();
    await this.#hooks.runner("starting").run(this);
    this.#hooks.clear("starting");
    await this.#preloadsManager.use(this.rcFile.preloads).import();
    await callback(this);
    await this.#providersManager.ready();
    await this.#hooks.runner("ready").run(this);
    this.#hooks.clear("ready");
    this.#state = "ready";
    debug_default("application ready");
    this.notify("ready");
  }
  /**
   * Register hooks that are called when the app is
   * ready
   */
  async ready(handler) {
    if (this.isReady) {
      await handler(this);
    } else {
      this.#hooks.add("ready", handler);
    }
  }
  /**
   * Register hooks that are called before the app is
   * terminated.
   */
  terminating(handler) {
    this.#hooks.add("terminating", handler);
    return this;
  }
  /**
   * Terminate application gracefully. Calling this method performs
   * the following operations.
   *
   * - Run "shutdown" hooks on all the providers
   * - Run "terminating" app lifecycle hooks
   */
  async terminate() {
    if (this.#state === "created" || this.#state === "terminated") {
      debug_default('cannot terminate app from state "%s"', this.#state);
      return;
    }
    if (this.#terminating) {
      debug_default("app is already being terminated");
      return;
    }
    const shutdownInReverseOrder = this.experimentalFlags.enabled("shutdownInReverseOrder");
    debug_default("terminating app");
    this.#terminating = true;
    if (shutdownInReverseOrder) {
      await this.#hooks.runner("terminating").runReverse(this);
    } else {
      await this.#hooks.runner("terminating").run(this);
    }
    await this.#providersManager.shutdown(shutdownInReverseOrder);
    this.#hooks.clear("terminating");
    this.#state = "terminated";
  }
  /**
   * Returns relative path to a file from the app root
   */
  relativePath(absolutePath) {
    return relative(fileURLToPath(this.appRoot), absolutePath);
  }
  /**
   * Returns URL to a path from the application root.
   */
  makeURL(...paths) {
    return new URL(join2(...paths), this.#appRoot);
  }
  /**
   * Returns file system path from the application root.
   */
  makePath(...paths) {
    return fileURLToPath(this.makeURL(...paths));
  }
  /**
   * Makes path to the config directory
   */
  configPath(...paths) {
    return this.makePath(this.rcFile.directories.config, ...paths);
  }
  /**
   * Makes path to the public directory
   */
  publicPath(...paths) {
    return this.makePath(this.rcFile.directories.public, ...paths);
  }
  /**
   * Makes path to the providers directory
   */
  providersPath(...paths) {
    return this.makePath(this.rcFile.directories.providers, ...paths);
  }
  /**
   * Makes path to the factories directory
   */
  factoriesPath(...paths) {
    return this.makePath(this.rcFile.directories.factories, ...paths);
  }
  /**
   * Makes path to the migrations directory
   */
  migrationsPath(...paths) {
    return this.makePath(this.rcFile.directories.migrations, ...paths);
  }
  /**
   * Makes path to the seeders directory
   */
  seedersPath(...paths) {
    return this.makePath(this.rcFile.directories.seeders, ...paths);
  }
  /**
   * Makes path to the language files directory
   */
  languageFilesPath(...paths) {
    return this.makePath(this.rcFile.directories.languageFiles, ...paths);
  }
  /**
   * Makes path to the views directory
   */
  viewsPath(...paths) {
    return this.makePath(this.rcFile.directories.views, ...paths);
  }
  /**
   * Makes path to the start directory
   */
  startPath(...paths) {
    return this.makePath(this.rcFile.directories.start, ...paths);
  }
  /**
   * Makes path to the tmp directory
   */
  tmpPath(...paths) {
    return this.makePath(this.rcFile.directories.tmp, ...paths);
  }
  /**
   * Makes path to the contracts directory
   * @deprecated
   */
  contractsPath(...paths) {
    return this.makePath(this.rcFile.directories.contracts, ...paths);
  }
  /**
   * Makes path to the http controllers directory
   */
  httpControllersPath(...paths) {
    return this.makePath(this.rcFile.directories.httpControllers, ...paths);
  }
  /**
   * Makes path to the models directory
   */
  modelsPath(...paths) {
    return this.makePath(this.rcFile.directories.models, ...paths);
  }
  /**
   * Makes path to the services directory
   */
  servicesPath(...paths) {
    return this.makePath(this.rcFile.directories.services, ...paths);
  }
  /**
   * Makes path to the exceptions directory
   */
  exceptionsPath(...paths) {
    return this.makePath(this.rcFile.directories.exceptions, ...paths);
  }
  /**
   * Makes path to the mailers directory
   */
  mailersPath(...paths) {
    return this.makePath(this.rcFile.directories.mailers, ...paths);
  }
  /**
   * Makes path to the mails directory
   */
  mailsPath(...paths) {
    return this.makePath(this.rcFile.directories.mails, ...paths);
  }
  /**
   * Makes path to the middleware directory
   */
  middlewarePath(...paths) {
    return this.makePath(this.rcFile.directories.middleware, ...paths);
  }
  /**
   * Makes path to the policies directory
   */
  policiesPath(...paths) {
    return this.makePath(this.rcFile.directories.policies, ...paths);
  }
  /**
   * Makes path to the validators directory
   */
  validatorsPath(...paths) {
    return this.makePath(this.rcFile.directories.validators, ...paths);
  }
  /**
   * Makes path to the commands directory
   */
  commandsPath(...paths) {
    return this.makePath(this.rcFile.directories.commands, ...paths);
  }
  /**
   * Makes path to the events directory
   */
  eventsPath(...paths) {
    return this.makePath(this.rcFile.directories.events, ...paths);
  }
  /**
   * Makes path to the listeners directory
   */
  listenersPath(...paths) {
    return this.makePath(this.rcFile.directories.listeners, ...paths);
  }
  /**
   * Import a module by identifier. This method uses the importer function
   * defined at the time of creating the application instance and throws
   * an error if no importer was defined.
   */
  import(moduleIdentifier) {
    if (!this.#importer) {
      throw new RuntimeException2(
        `Cannot import "${moduleIdentifier}". Register a module importer with the application first.`
      );
    }
    return this.#importer(moduleIdentifier);
  }
  /**
   * Import a module by identifier. This method uses the importer function
   * defined at the time of creating the application instance and throws
   * an error if no importer was defined.
   */
  importDefault(moduleIdentifier) {
    if (!this.#importer) {
      throw new RuntimeException2(
        `Cannot import "${moduleIdentifier}". Register a module importer with the application first.`
      );
    }
    return importDefault(() => this.#importer(moduleIdentifier));
  }
  /**
   * JSON representation of the application
   */
  toJSON() {
    return {
      isReady: this.isReady,
      isTerminating: this.isTerminating,
      environment: this.#environment,
      nodeEnvironment: this.nodeEnvironment,
      appName: this.appName,
      version: this.version ? this.version.toString() : null,
      adonisVersion: this.adonisVersion ? this.adonisVersion.toString() : null
    };
  }
};

export {
  errors_exports,
  generators_default,
  RcFileParser,
  FeatureFlags,
  Application
};
