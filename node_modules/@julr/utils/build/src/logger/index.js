// src/logger/logger.ts
var TestLogger = class {
  logs = [];
  child() {
    return this;
  }
  trace(obj, msg) {
    this.logs.push({ level: "trace", msg, obj });
  }
  debug(obj, msg) {
    this.logs.push({ level: "debug", msg, obj });
  }
  info(obj, msg) {
    this.logs.push({ level: "info", msg, obj });
  }
  warn(obj, msg) {
    this.logs.push({ level: "warn", msg, obj });
  }
  error(obj, msg) {
    this.logs.push({ level: "error", msg, obj });
  }
  fatal(obj, msg) {
    this.logs.push({ level: "fatal", msg, obj });
  }
};
function testLogger() {
  return new TestLogger();
}
function noopLogger() {
  return {
    trace: () => {
    },
    debug: () => {
    },
    info: () => {
    },
    warn: () => {
    },
    error: () => {
    },
    fatal: () => {
    },
    child: () => noopLogger()
  };
}
var levelNumber = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};
function consoleLogger(level = "warn", context) {
  const log = (lvl, ...rest) => {
    if (levelNumber[level] > levelNumber[lvl]) return;
    if (context) return console.log(lvl.toUpperCase(), context, ...rest);
    console.log(lvl.toUpperCase(), ...rest);
  };
  return {
    trace: (...rest) => log("trace", ...rest),
    debug: (...rest) => log("debug", ...rest),
    info: (...rest) => log("info", ...rest),
    warn: (...rest) => log("warn", ...rest),
    error: (...rest) => log("error", ...rest),
    fatal: (...rest) => log("fatal", ...rest),
    child: (childObj) => consoleLogger(level, context ? { ...context, ...childObj } : { ...childObj })
  };
}
export {
  consoleLogger,
  noopLogger,
  testLogger
};
