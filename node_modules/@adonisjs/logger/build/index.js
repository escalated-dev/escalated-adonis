import {
  Logger,
  destination,
  multistream,
  stdSerializers,
  stdTimeFunctions,
  transport
} from "./chunk-OKMTVXME.js";

// src/targets/file.ts
function file(options, level) {
  return {
    target: "pino/file",
    level,
    options: options || {}
  };
}

// src/targets/create.ts
var Targets = class {
  #collection = [];
  /**
   * Add target to the list of targets
   */
  push(value) {
    this.#collection.push(value);
    return this;
  }
  /**
   * Conditionally add target to the list targets. The target will only be added
   *  if the `conditional` is true.
   *
   * ```ts
   * targets.if(process.env.NODE_ENV === 'development', {
   *   target: 'pino-pretty'
   * })
   * ```
   */
  pushIf(conditional, value) {
    if (conditional) {
      this.#collection.push(typeof value === "function" ? value() : value);
    }
    return this;
  }
  /**
   * Conditionally add target to the list targets. The target will only be added
   * unless the `conditional` is true.
   *
   * ```ts
   * targets.unless(process.env.NODE_ENV === 'production', {
   *   target: 'pino-pretty'
   * })
   * ```
   */
  pushUnless(conditional, value) {
    if (!conditional) {
      this.#collection.push(typeof value === "function" ? value() : value);
    }
    return this;
  }
  /**
   * Get targets array
   */
  toArray() {
    return this.#collection;
  }
};

// src/targets/pretty.ts
function pretty(options, level) {
  return {
    target: "pino-pretty",
    level,
    options: options || {}
  };
}

// src/targets/main.ts
function targets() {
  return new Targets();
}
targets.file = file;
targets.pretty = pretty;

// src/define_config.ts
import { RuntimeException } from "@poppinss/utils";

// src/debug.ts
import { debuglog } from "util";
var debug_default = debuglog("adonisjs:logger");

// src/define_config.ts
function defineConfig(config) {
  if (!config.loggers) {
    throw new RuntimeException('Missing "loggers" property in logger config file');
  }
  if (!config.default) {
    throw new RuntimeException(
      'Missing "default" property in logger config. Specify a default logger'
    );
  }
  if (!config.loggers[config.default]) {
    throw new RuntimeException(
      `Missing "loggers.${String(config.default)}". It is referenced by the "default" logger`
    );
  }
  Object.keys(config.loggers).forEach((loggerName) => {
    const logger = config.loggers[loggerName];
    if (logger.transport && "targets" in logger.transport) {
      logger.transport.targets.forEach((target) => {
        if (!target.level) {
          if ("target" in target) {
            debug_default('inherting "%s" target level from "%s" logger', target.target, loggerName);
          } else {
            debug_default('inherting %O target level from "%s" logger', target, loggerName);
          }
          target.level = logger.level;
        }
      });
    }
  });
  return config;
}

// src/logger_manager.ts
var LoggerManager = class extends Logger {
  /**
   * Registered config
   */
  #config;
  /**
   * Created loggers. Logger instances are cached forever
   */
  #loggers = /* @__PURE__ */ new Map();
  constructor(config) {
    super(config.loggers[config.default]);
    this.#config = config;
    debug_default("creating logger manager. config: %O", this.#config);
  }
  /**
   * Creates an instance of the logger
   */
  createLogger(logger, config) {
    if (!config.name && typeof logger === "string") {
      config.name = logger;
    }
    return new Logger(config);
  }
  use(logger) {
    let loggerToUse = logger || this.#config.default;
    if (this.#loggers.has(loggerToUse)) {
      debug_default('using logger from cache. name: "%s"', logger);
      return this.#loggers.get(loggerToUse);
    }
    const config = this.#config.loggers[loggerToUse];
    debug_default('creating logger. name: "%s", config: %O', loggerToUse, config);
    const loggerInstance = this.createLogger(loggerToUse, config);
    this.#loggers.set(loggerToUse, loggerInstance);
    return loggerInstance;
  }
  /**
   * Create a logger instance from the config. The created instance
   * is not managed by the manager
   */
  create(config, pino) {
    return new Logger(config, pino);
  }
};
export {
  Logger,
  LoggerManager,
  defineConfig,
  destination,
  multistream,
  stdSerializers,
  stdTimeFunctions,
  targets,
  transport
};
