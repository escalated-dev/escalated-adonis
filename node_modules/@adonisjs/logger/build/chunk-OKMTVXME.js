// src/pino.ts
import {
  pino,
  version,
  transport,
  multistream,
  destination,
  stdSerializers,
  stdTimeFunctions
} from "pino";
var TimestampFormatters = {
  iso: stdTimeFunctions.isoTime,
  epoch: stdTimeFunctions.epochTime,
  unix: stdTimeFunctions.unixTime
};
function createPino(options) {
  const { desination, timestamp, ...rest } = options;
  const pinoOptions = Object.assign({}, rest);
  if (typeof timestamp === "string" && TimestampFormatters[timestamp]) {
    pinoOptions.timestamp = TimestampFormatters[timestamp];
  } else if (typeof timestamp === "boolean" || typeof timestamp === "function") {
    pinoOptions.timestamp = timestamp;
  }
  return desination ? pino(pinoOptions, desination) : pino(pinoOptions);
}
var levels = {
  labels: {
    10: "trace",
    20: "debug",
    30: "info",
    40: "warn",
    50: "error",
    60: "fatal"
  },
  values: {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    debug: 20,
    trace: 10
  }
};

// src/logger.ts
import abstractLogging from "abstract-logging";
var Logger = class _Logger {
  constructor(config, pino2) {
    this.config = config;
    if (!this.config.enabled) {
      this.pino = abstractLogging;
    } else {
      this.pino = pino2 || createPino(this.config);
    }
  }
  pino;
  /**
   * Check if the logger is enabled
   */
  get isEnabled() {
    return this.config.enabled;
  }
  /**
   * A map of levels
   */
  get levels() {
    if (!this.isEnabled) {
      return levels;
    }
    return this.pino.levels;
  }
  /**
   * Returns the current logger level
   */
  get level() {
    if (!this.isEnabled) {
      return this.config.level || "info";
    }
    return this.pino.level;
  }
  /**
   * Update logger level
   */
  set level(level) {
    if (!this.isEnabled) {
      this.config.level = level;
      return;
    }
    this.pino.level = level;
  }
  /**
   * Returns the current logger level number
   */
  get levelNumber() {
    if (!this.isEnabled) {
      return levels.values[this.config.level || "info"];
    }
    return this.pino.levelVal;
  }
  /**
   * Returns the pino version
   */
  get pinoVersion() {
    return version;
  }
  /**
   * Returns the pino version
   */
  get version() {
    return version;
  }
  /**
   * Returns a boolean telling if level is enabled or
   * not.
   */
  isLevelEnabled(level) {
    if (!this.isEnabled) {
      return false;
    }
    return this.pino.isLevelEnabled(level);
  }
  ifLevelEnabled(level, callback) {
    if (this.isLevelEnabled(level)) {
      return callback(this);
    }
  }
  log(level, mergingObject, message, ...values) {
    if (!this.isEnabled) {
      return;
    }
    this.pino[level](mergingObject, message, ...values);
  }
  trace(mergingObject, message, ...values) {
    this.log("trace", mergingObject, message, ...values);
  }
  debug(mergingObject, message, ...values) {
    this.log("debug", mergingObject, message, ...values);
  }
  info(mergingObject, message, ...values) {
    this.log("info", mergingObject, message, ...values);
  }
  warn(mergingObject, message, ...values) {
    this.log("warn", mergingObject, message, ...values);
  }
  error(mergingObject, message, ...values) {
    this.log("error", mergingObject, message, ...values);
  }
  fatal(mergingObject, message, ...values) {
    this.log("fatal", mergingObject, message, ...values);
  }
  silent(mergingObject, message, ...values) {
    this.log("silent", mergingObject, message, ...values);
  }
  /**
   * Returns a child logger instance
   */
  child(bindings, options) {
    if (!this.isEnabled) {
      return this;
    }
    return new _Logger(this.config, this.pino.child(bindings, options));
  }
  /**
   * Returns default bindings for the logger
   */
  bindings() {
    if (!this.isEnabled) {
      return {};
    }
    return this.pino.bindings();
  }
};

export {
  transport,
  multistream,
  destination,
  stdSerializers,
  stdTimeFunctions,
  Logger
};
