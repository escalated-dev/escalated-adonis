var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/loader.ts
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// src/debug.ts
import { debuglog } from "node:util";
var debug_default = debuglog("adonisjs:env");

// src/loader.ts
var EnvLoader = class {
  #appRoot;
  #loadExampleFile;
  constructor(appRoot, loadExampleFile = false) {
    this.#appRoot = typeof appRoot === "string" ? appRoot : fileURLToPath(appRoot);
    this.#loadExampleFile = loadExampleFile;
  }
  /**
   * Optionally read a file from the disk
   */
  async #loadFile(filePath) {
    try {
      const contents = await readFile(filePath, "utf-8");
      return { contents, fileExists: true };
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      return { contents: "", fileExists: false };
    }
  }
  /**
   * Load contents of the main dot-env file and the current
   * environment dot-env file
   */
  async load() {
    const ENV_PATH = process.env.ENV_PATH;
    const NODE_ENV = process.env.NODE_ENV;
    const envFiles = [];
    if (debug_default.enabled) {
      debug_default("ENV_PATH variable is %s", ENV_PATH ? "set" : "not set");
      debug_default("NODE_ENV variable is %s", NODE_ENV ? "set" : "not set");
    }
    const baseEnvPath = ENV_PATH ? isAbsolute(ENV_PATH) ? ENV_PATH : join(this.#appRoot, ENV_PATH) : this.#appRoot;
    if (debug_default.enabled) {
      debug_default('dot-env files base path "%s"', baseEnvPath);
    }
    if (NODE_ENV) {
      const nodeEnvLocalFile = join(baseEnvPath, `.env.${NODE_ENV}.local`);
      envFiles.push({
        path: nodeEnvLocalFile,
        ...await this.#loadFile(nodeEnvLocalFile)
      });
    }
    if (!NODE_ENV || !["test", "testing"].includes(NODE_ENV)) {
      const envLocalFile = join(baseEnvPath, ".env.local");
      envFiles.push({
        path: envLocalFile,
        ...await this.#loadFile(envLocalFile)
      });
    }
    if (NODE_ENV) {
      const nodeEnvFile = join(baseEnvPath, `.env.${NODE_ENV}`);
      envFiles.push({
        path: nodeEnvFile,
        ...await this.#loadFile(nodeEnvFile)
      });
    }
    const envFile = join(baseEnvPath, ".env");
    envFiles.push({
      path: envFile,
      ...await this.#loadFile(envFile)
    });
    if (this.#loadExampleFile) {
      const envExampleFile = join(baseEnvPath, ".env.example");
      envFiles.push({
        path: envExampleFile,
        ...await this.#loadFile(envExampleFile)
      });
    }
    return envFiles;
  }
};

export {
  __export,
  debug_default,
  EnvLoader
};
//# sourceMappingURL=chunk-VIQ26ZGM.js.map