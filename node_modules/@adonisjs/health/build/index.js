// src/result.ts
var Result = class _Result {
  constructor(message, status, finishedAt) {
    this.message = message;
    this.status = status;
    this.finishedAt = finishedAt;
  }
  /**
   * Create result for success status
   */
  static ok(message) {
    return new _Result(message, "ok", /* @__PURE__ */ new Date());
  }
  static failed(message, error) {
    const result = new _Result(
      typeof message === "string" ? message : message.message,
      "error",
      /* @__PURE__ */ new Date()
    );
    if (error) {
      result.setMetaData({ error });
    }
    if (typeof message !== "string") {
      result.setMetaData({ error: message });
    }
    return result;
  }
  /**
   * Create result for warning status
   */
  static warning(message) {
    return new _Result(message, "warning", /* @__PURE__ */ new Date());
  }
  /**
   * Update the finished at timestamp for the result
   */
  setFinishedAt(finishedAt) {
    this.finishedAt = finishedAt;
    return this;
  }
  /**
   * Define custom meta-data for the result. Calling this method will
   * override the existing meta-data
   */
  setMetaData(metaData) {
    this.meta = metaData;
    return this;
  }
  /**
   * Merge custom meta-data with the existing meta-data. A shallow
   * merge is performed
   */
  mergeMetaData(metaData) {
    this.meta = { ...this.meta, ...metaData };
    return this;
  }
  toJSON() {
    return {
      finishedAt: this.finishedAt,
      message: this.message,
      status: this.status,
      ...this.meta ? { meta: this.meta } : {}
    };
  }
};

// src/base_check.ts
import stringHelpers from "@poppinss/utils/string";
var BaseCheck = class {
  /**
   * Define a custom unique name for the check
   */
  as(name) {
    this.name = name;
    return this;
  }
  /**
   * Specify the duration for which the check should be
   * cached for
   */
  cacheFor(duration) {
    this.cacheDuration = stringHelpers.seconds.parse(duration);
    return this;
  }
};

// src/debug.ts
import { debuglog } from "node:util";
var debug_default = debuglog("adonisjs:health");

// src/health_checks.ts
var HealthChecks = class {
  /**
   * Registered health checks
   */
  #checks = [];
  /**
   * The cachedResults map is used to keep the results of a given
   * health check (only if caching for that check is enabled).
   */
  #cachedResults = /* @__PURE__ */ new Map();
  /**
   * Returns the debugging info of the process
   */
  #getDebugInfo() {
    return {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      uptime: process.uptime(),
      version: process.version
    };
  }
  /**
   * Executes the check and respects the caching layer as well
   */
  async #runCheck(check) {
    if (check.cacheDuration) {
      const cachedResult = this.#cachedResults.get(check.name);
      const cacheMilliseconds = Math.floor(check.cacheDuration * 1e3);
      if (cachedResult && Date.now() < cachedResult.finishedAt.getTime() + cacheMilliseconds) {
        debug_default('returning cached results for "%s" check', check.name, cachedResult);
        return {
          name: check.name,
          isCached: true,
          ...cachedResult
        };
      }
      const result2 = await check.run();
      debug_default('executed "%s" check', check.name, result2);
      this.#cachedResults.set(check.name, result2);
      return {
        name: check.name,
        isCached: false,
        ...result2
      };
    }
    const result = await check.run();
    debug_default('executed "%s" check', check.name, result);
    return {
      name: check.name,
      isCached: false,
      ...result
    };
  }
  /**
   * Register health checks. Existing health checks will be
   * removed during the register method call
   */
  register(checks) {
    this.#checks = checks;
    return this;
  }
  /**
   * Append new set of health checks
   */
  append(checks) {
    this.#checks = this.#checks.concat(checks);
    return this;
  }
  /**
   * Executes all the checks in parallel and returns the
   * health check report
   */
  async run() {
    let isHealthy = true;
    let status = "ok";
    const checks = await Promise.all(
      this.#checks.map(async (check) => {
        const result = await this.#runCheck(check);
        if (result.status === "error") {
          status = "error";
          isHealthy = false;
        } else if (status === "ok" && result.status === "warning") {
          status = "warning";
        }
        return result;
      })
    );
    const finishedAt = /* @__PURE__ */ new Date();
    return {
      isHealthy,
      status,
      finishedAt,
      debugInfo: this.#getDebugInfo(),
      checks
    };
  }
};

// src/checks/rss_check.ts
import stringHelpers2 from "@poppinss/utils/string";
var MemoryRSSCheck = class extends BaseCheck {
  #warnThreshold = stringHelpers2.bytes.parse("320 mb");
  #failThreshold = stringHelpers2.bytes.parse("350 mb");
  #computeFn = () => {
    return process.memoryUsage();
  };
  name = "Memory RSS check";
  /**
   * Define the RSS threshold after which a warning
   * should be created.
   *
   * - The value should be either a number in bytes
   * - Or it should be a value expression in string.
   *
   * ```
   * .warnWhenExceeds('200 mb')
   * ```
   */
  warnWhenExceeds(value) {
    this.#warnThreshold = stringHelpers2.bytes.parse(value);
    return this;
  }
  /**
   * Define the RSS threshold after which an error
   * should be created.
   *
   * - The value should be either a number in bytes
   * - Or it should be a value expression in string.
   *
   * ```
   * .failWhenExceeds('500 mb')
   * ```
   */
  failWhenExceeds(value) {
    this.#failThreshold = stringHelpers2.bytes.parse(value);
    return this;
  }
  /**
   * Define a custom callback to compute the RSS size. Defaults to
   * using "process.memoryUsage()" method call
   */
  compute(callback) {
    this.#computeFn = callback;
    return this;
  }
  async run() {
    const { rss } = this.#computeFn();
    const metaData = {
      memoryInBytes: {
        used: rss,
        failureThreshold: this.#failThreshold,
        warningThreshold: this.#warnThreshold
      }
    };
    if (rss > this.#failThreshold) {
      return Result.failed(
        `RSS usage is ${stringHelpers2.bytes.format(rss)}, which is above the threshold of ${stringHelpers2.bytes.format(this.#failThreshold)}`
      ).mergeMetaData(metaData);
    }
    if (rss > this.#warnThreshold) {
      return Result.warning(
        `RSS usage is ${stringHelpers2.bytes.format(rss)}, which is above the threshold of ${stringHelpers2.bytes.format(this.#warnThreshold)}`
      ).mergeMetaData(metaData);
    }
    return Result.ok("RSS usage is under defined thresholds").mergeMetaData(metaData);
  }
};

// src/checks/heap_check.ts
import stringHelpers3 from "@poppinss/utils/string";
var MemoryHeapCheck = class extends BaseCheck {
  #warnThreshold = stringHelpers3.bytes.parse("250 mb");
  #failThreshold = stringHelpers3.bytes.parse("300 mb");
  #computeFn = () => {
    return process.memoryUsage();
  };
  name = "Memory heap check";
  /**
   * Define the heap threshold after which a warning
   * should be created.
   *
   * - The value should be either a number in bytes
   * - Or it should be a value expression in string.
   *
   * ```
   * .warnWhenExceeds('200 mb')
   * ```
   */
  warnWhenExceeds(value) {
    this.#warnThreshold = stringHelpers3.bytes.parse(value);
    return this;
  }
  /**
   * Define the heap threshold after which an error
   * should be created.
   *
   * - The value should be either a number in bytes
   * - Or it should be a value expression in string.
   *
   * ```
   * .failWhenExceeds('500 mb')
   * ```
   */
  failWhenExceeds(value) {
    this.#failThreshold = stringHelpers3.bytes.parse(value);
    return this;
  }
  /**
   * Define a custom callback to compute the heap size. Defaults to
   * using "process.memoryUsage()" method call
   */
  compute(callback) {
    this.#computeFn = callback;
    return this;
  }
  async run() {
    const { heapUsed } = this.#computeFn();
    const metaData = {
      memoryInBytes: {
        used: heapUsed,
        failureThreshold: this.#failThreshold,
        warningThreshold: this.#warnThreshold
      }
    };
    if (heapUsed > this.#failThreshold) {
      return Result.failed(
        `Heap usage is ${stringHelpers3.bytes.format(heapUsed)}, which is above the threshold of ${stringHelpers3.bytes.format(this.#failThreshold)}`
      ).mergeMetaData(metaData);
    }
    if (heapUsed > this.#warnThreshold) {
      return Result.warning(
        `Heap usage is ${stringHelpers3.bytes.format(heapUsed)}, which is above the threshold of ${stringHelpers3.bytes.format(this.#warnThreshold)}`
      ).mergeMetaData(metaData);
    }
    return Result.ok("Heap usage is under defined thresholds").mergeMetaData(metaData);
  }
};

// src/checks/disk_space_check.ts
import checkDiskSpace from "check-disk-space";
var DiskSpaceCheck = class extends BaseCheck {
  #warnThreshold = 75;
  #failThreshold = 80;
  #computeFn = () => {
    return checkDiskSpace(this.diskPath);
  };
  name = "Disk space check";
  diskPath = process.platform === "win32" ? "C:\\" : "/";
  /**
   * Define the percentage threshold after which a
   * warning should be created
   */
  warnWhenExceeds(valueInPercentage) {
    this.#warnThreshold = valueInPercentage;
    return this;
  }
  /**
   * Define the percentage threshold after which an
   * error should be created
   */
  failWhenExceeds(valueInPercentage) {
    this.#failThreshold = valueInPercentage;
    return this;
  }
  /**
   * Define a custom callback to compute the disk space. Defaults to
   * using "check-disk-space" package
   */
  compute(callback) {
    this.#computeFn = callback;
    return this;
  }
  async run() {
    const { free, size } = await this.#computeFn();
    const usedPercentage = Math.floor((size - free) / size * 100);
    const metaData = {
      sizeInPercentage: {
        used: usedPercentage,
        failureThreshold: this.#failThreshold,
        warningThreshold: this.#warnThreshold
      }
    };
    if (usedPercentage >= this.#failThreshold) {
      return Result.failed(
        `Disk usage is ${usedPercentage}%, which is above the threshold of ${this.#failThreshold}%`
      ).mergeMetaData(metaData);
    }
    if (usedPercentage >= this.#warnThreshold) {
      return Result.warning(
        `Disk usage is ${usedPercentage}%, which is above the threshold of ${this.#warnThreshold}%`
      ).mergeMetaData(metaData);
    }
    return Result.ok("Disk usage is under defined thresholds").mergeMetaData(metaData);
  }
};
export {
  BaseCheck,
  DiskSpaceCheck,
  HealthChecks,
  MemoryHeapCheck,
  MemoryRSSCheck,
  Result
};
//# sourceMappingURL=index.js.map