// src/bundler.ts
import slash from "slash";
import dedent from "dedent";
import fs from "node:fs/promises";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { join as join2, relative as relative2 } from "node:path";
import { cliui } from "@poppinss/cliui";
import { detectPackageManager } from "@antfu/install-pkg";

// src/hooks.ts
import { RuntimeException } from "@poppinss/utils";
import Hooks from "@poppinss/hooks";
var AssemblerHooks = class {
  #config;
  #hooks = new Hooks();
  constructor(config) {
    this.#config = config;
  }
  /**
   * Resolve the hook by importing the file and returning the default export
   */
  async #resolveHookNode(node) {
    const exports = await node();
    if (!exports.default) {
      throw new RuntimeException("Assembler hook must be defined using the default export");
    }
    return exports.default;
  }
  /**
   * Resolve hooks needed for dev-time and register them to the Hooks instance
   */
  async registerDevServerHooks() {
    await Promise.all([
      ...(this.#config?.onDevServerStarted || []).map(
        async (node) => this.#hooks.add("onDevServerStarted", await this.#resolveHookNode(node))
      ),
      ...(this.#config?.onSourceFileChanged || []).map(
        async (node) => this.#hooks.add("onSourceFileChanged", await this.#resolveHookNode(node))
      )
    ]);
  }
  /**
   * Resolve hooks needed for build-time and register them to the Hooks instance
   */
  async registerBuildHooks() {
    await Promise.all([
      ...(this.#config?.onBuildStarting || []).map(
        async (node) => this.#hooks.add("onBuildStarting", await this.#resolveHookNode(node))
      ),
      ...(this.#config?.onBuildCompleted || []).map(
        async (node) => this.#hooks.add("onBuildCompleted", await this.#resolveHookNode(node))
      )
    ]);
  }
  /**
   * When the dev server is started
   */
  async onDevServerStarted(...args) {
    await this.#hooks.runner("onDevServerStarted").run(...args);
  }
  /**
   * When a source file changes
   */
  async onSourceFileChanged(...args) {
    await this.#hooks.runner("onSourceFileChanged").run(...args);
  }
  /**
   * When the build process is starting
   */
  async onBuildStarting(...args) {
    await this.#hooks.runner("onBuildStarting").run(...args);
  }
  /**
   * When the build process is completed
   */
  async onBuildCompleted(...args) {
    await this.#hooks.runner("onBuildCompleted").run(...args);
  }
};

// src/helpers.ts
import { isJunk } from "junk";
import fastGlob from "fast-glob";
import getRandomPort from "get-port";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execaNode, execa } from "execa";
import { copyFile, mkdir } from "node:fs/promises";
import { EnvLoader, EnvParser } from "@adonisjs/env";
import { ConfigParser, Watcher } from "@poppinss/chokidar-ts";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

// src/debug.ts
import { debuglog } from "node:util";
var debug_default = debuglog("adonisjs:assembler");

// src/helpers.ts
var DEFAULT_NODE_ARGS = [
  // Use ts-node/esm loader. The project must install it
  process.versions.tsNodeMaintained ? "--import=ts-node-maintained/register/esm" : "--loader=ts-node/esm",
  // Enable source maps, since TSNode source maps are broken
  "--enable-source-maps"
];
if (process.allowedNodeEnvironmentFlags.has("--disable-warning")) {
  DEFAULT_NODE_ARGS.push("--disable-warning=ExperimentalWarning");
} else {
  DEFAULT_NODE_ARGS.push("--no-warnings");
}
function parseConfig(cwd, ts) {
  const { config, error } = new ConfigParser(cwd, "tsconfig.json", ts).parse();
  if (error) {
    const compilerHost = ts.createCompilerHost({});
    console.log(ts.formatDiagnosticsWithColorAndContext([error], compilerHost));
    return;
  }
  if (config.errors.length) {
    const compilerHost = ts.createCompilerHost({});
    console.log(ts.formatDiagnosticsWithColorAndContext(config.errors, compilerHost));
    return;
  }
  return config;
}
function runNode(cwd, options) {
  const childProcess = execaNode(options.script, options.scriptArgs, {
    nodeOptions: DEFAULT_NODE_ARGS.concat(options.nodeArgs),
    preferLocal: true,
    windowsHide: false,
    localDir: cwd,
    cwd,
    reject: options.reject ?? false,
    buffer: false,
    stdio: options.stdio || "inherit",
    env: {
      ...options.stdio === "pipe" ? { FORCE_COLOR: "true" } : {},
      ...options.env
    }
  });
  return childProcess;
}
function run(cwd, options) {
  const childProcess = execa(options.script, options.scriptArgs, {
    preferLocal: true,
    windowsHide: false,
    localDir: cwd,
    cwd,
    buffer: false,
    stdio: options.stdio || "inherit",
    env: {
      ...options.stdio === "pipe" ? { FORCE_COLOR: "true" } : {},
      ...options.env
    }
  });
  return childProcess;
}
function watch(cwd, ts, options) {
  const config = parseConfig(cwd, ts);
  if (!config) {
    return;
  }
  const watcher = new Watcher(typeof cwd === "string" ? cwd : fileURLToPath(cwd), config);
  const chokidar = watcher.watch(["."], { usePolling: options.poll });
  return { watcher, chokidar };
}
function isDotEnvFile(filePath) {
  if (filePath === ".env") {
    return true;
  }
  return filePath.includes(".env.");
}
async function getPort(cwd) {
  if (process.env.PORT) {
    return getRandomPort({ port: Number(process.env.PORT) });
  }
  const files = await new EnvLoader(cwd).load();
  for (let file of files) {
    const envVariables = await new EnvParser(file.contents).parse();
    if (envVariables.PORT) {
      return getRandomPort({ port: Number(envVariables.PORT) });
    }
  }
  return getRandomPort({ port: 3333 });
}
async function copyFiles(files, cwd, outDir) {
  const { paths, patterns } = files.reduce(
    (result, file) => {
      if (fastGlob.isDynamicPattern(file)) {
        result.patterns.push(file);
        return result;
      }
      if (existsSync(join(cwd, file))) {
        result.paths.push(file);
      }
      return result;
    },
    { patterns: [], paths: [] }
  );
  debug_default("copyFiles inputs: %O, paths: %O, patterns: %O", files, paths, patterns);
  const filePaths = paths.concat(await fastGlob(patterns, { cwd, dot: true })).filter((file) => {
    return !isJunk(basename(file));
  });
  debug_default('copying files %O to destination "%s"', filePaths, outDir);
  const copyPromises = filePaths.map(async (file) => {
    const src = isAbsolute(file) ? file : join(cwd, file);
    const dest = join(outDir, relative(cwd, src));
    await mkdir(dirname(dest), { recursive: true });
    return copyFile(src, dest);
  });
  return await Promise.all(copyPromises);
}

// src/bundler.ts
var SUPPORT_PACKAGE_MANAGERS = {
  "npm": {
    packageManagerFiles: ["package-lock.json"],
    installCommand: 'npm ci --omit="dev"'
  },
  "yarn": {
    packageManagerFiles: ["yarn.lock"],
    installCommand: "yarn install --production"
  },
  "yarn@berry": {
    packageManagerFiles: ["yarn.lock", ".yarn/**/*", ".yarnrc.yml"],
    installCommand: "yarn workspaces focus --production"
  },
  "pnpm": {
    packageManagerFiles: ["pnpm-lock.yaml"],
    installCommand: "pnpm i --prod"
  },
  "bun": {
    packageManagerFiles: ["bun.lockb"],
    installCommand: "bun install --production"
  }
};
var ui = cliui();
var Bundler = class {
  #cwd;
  #cwdPath;
  #ts;
  #logger = ui.logger;
  #hooks;
  #options;
  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors();
  }
  constructor(cwd, ts, options) {
    this.#cwd = cwd;
    this.#cwdPath = fileURLToPath2(this.#cwd);
    this.#ts = ts;
    this.#options = options;
    this.#hooks = new AssemblerHooks(options.hooks);
  }
  /**
   * Returns the relative unix path for an absolute
   * file path
   */
  #getRelativeName(filePath) {
    return slash(relative2(this.#cwdPath, filePath));
  }
  /**
   * Cleans up the build directory
   */
  async #cleanupBuildDirectory(outDir) {
    await fs.rm(outDir, { recursive: true, force: true, maxRetries: 5 });
  }
  /**
   * Runs assets bundler command to build assets
   */
  async #buildAssets() {
    const assetsBundler = this.#options.assets;
    if (!assetsBundler?.enabled) {
      return true;
    }
    try {
      this.#logger.info("compiling frontend assets", { suffix: assetsBundler.cmd });
      await run(this.#cwd, {
        stdio: "inherit",
        reject: true,
        script: assetsBundler.cmd,
        scriptArgs: assetsBundler.args
      });
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Runs tsc command to build the source.
   */
  async #runTsc(outDir) {
    try {
      await run(this.#cwd, {
        stdio: "inherit",
        script: "tsc",
        scriptArgs: ["--outDir", outDir]
      });
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Copy meta files to the output directory
   */
  async #copyMetaFiles(outDir, additionalFilesToCopy) {
    const metaFiles = (this.#options.metaFiles || []).map((file) => file.pattern).concat(additionalFilesToCopy);
    await copyFiles(metaFiles, this.#cwdPath, outDir);
  }
  /**
   * Detect the package manager used by the project
   * and return the lockfile name and install command
   * related to it.
   */
  async #getPackageManager(client) {
    let pkgManager = client;
    if (!pkgManager) {
      pkgManager = await detectPackageManager(this.#cwdPath);
    }
    if (!pkgManager) {
      pkgManager = "npm";
    }
    if (!Object.keys(SUPPORT_PACKAGE_MANAGERS).includes(pkgManager)) {
      return null;
    }
    return SUPPORT_PACKAGE_MANAGERS[pkgManager];
  }
  /**
   * Rewrite the ace file since the original one
   * is importing ts-node which is not installed
   * in a production environment.
   */
  async #createAceFile(outDir) {
    const aceFileLocation = join2(outDir, "ace.js");
    const aceFileContent = dedent(
      /* JavaScript */
      `
      /**
       * This file is auto-generated by the build process.
       * If you had any custom code inside this file, then
       * instead write it inside the "bin/console.js" file.
       */

      await import('./bin/console.js')
    `
    );
    await fs.writeFile(aceFileLocation, aceFileContent);
    this.#logger.info("rewrited ace file", { suffix: this.#getRelativeName(aceFileLocation) });
  }
  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger) {
    this.#logger = logger;
    return this;
  }
  /**
   * Bundles the application to be run in production
   */
  async bundle(stopOnError = true, client) {
    await this.#hooks.registerBuildHooks();
    const config = parseConfig(this.#cwd, this.#ts);
    if (!config) {
      return false;
    }
    const outDir = config.options.outDir || fileURLToPath2(new URL("build/", this.#cwd));
    this.#logger.info("cleaning up output directory", { suffix: this.#getRelativeName(outDir) });
    await this.#cleanupBuildDirectory(outDir);
    if (!await this.#buildAssets()) {
      return false;
    }
    await this.#hooks.onBuildStarting({ colors: ui.colors, logger: this.#logger });
    this.#logger.info("compiling typescript source", { suffix: "tsc" });
    const buildCompleted = await this.#runTsc(outDir);
    await this.#createAceFile(outDir);
    if (!buildCompleted && stopOnError) {
      await this.#cleanupBuildDirectory(outDir);
      const instructions = ui.sticker().fullScreen().drawBorder((borderChar, colors) => colors.red(borderChar));
      instructions.add(
        this.#colors.red("Cannot complete the build process as there are TypeScript errors.")
      );
      instructions.add(
        this.#colors.red(
          'Use "--ignore-ts-errors" flag to ignore TypeScript errors and continue the build.'
        )
      );
      this.#logger.logError(instructions.prepare());
      return false;
    }
    const pkgManager = await this.#getPackageManager(client);
    const pkgFiles = pkgManager ? ["package.json", ...pkgManager.packageManagerFiles] : ["package.json"];
    this.#logger.info("copying meta files to the output directory");
    await this.#copyMetaFiles(outDir, pkgFiles);
    this.#logger.success("build completed");
    this.#logger.log("");
    await this.#hooks.onBuildCompleted({ colors: ui.colors, logger: this.#logger });
    ui.instructions().useRenderer(this.#logger.getRenderer()).heading("Run the following commands to start the server in production").add(this.#colors.cyan(`cd ${this.#getRelativeName(outDir)}`)).add(
      this.#colors.cyan(
        pkgManager ? pkgManager.installCommand : "Install production dependencies"
      )
    ).add(this.#colors.cyan("node bin/server.js")).render();
    return true;
  }
};

// src/dev_server.ts
import picomatch from "picomatch";
import { relative as relative3 } from "node:path";
import prettyHrtime from "pretty-hrtime";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { cliui as cliui3 } from "@poppinss/cliui";

// src/assets_dev_server.ts
import { cliui as cliui2 } from "@poppinss/cliui";
var ui2 = cliui2();
var AssetsDevServer = class {
  #cwd;
  #logger = ui2.logger;
  #options;
  #devServer;
  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors();
  }
  constructor(cwd, options) {
    this.#cwd = cwd;
    this.#options = options;
  }
  /**
   * Logs messages from vite dev server stdout and stderr
   */
  #logViteDevServerMessage(data) {
    const dataString = data.toString();
    const lines = dataString.split("\n");
    if (dataString.includes("Local") && dataString.includes("Network")) {
      const sticker = ui2.sticker().useColors(this.#colors).useRenderer(this.#logger.getRenderer());
      lines.forEach((line) => {
        if (line.trim()) {
          sticker.add(line);
        }
      });
      sticker.render();
      return;
    }
    if (dataString.includes("ready in")) {
      console.log("");
      console.log(dataString.trim());
      return;
    }
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(line);
      }
    });
  }
  /**
   * Logs messages from assets dev server stdout and stderr
   */
  #logAssetsDevServerMessage(data) {
    const dataString = data.toString();
    const lines = dataString.split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log(line);
      }
    });
  }
  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger) {
    this.#logger = logger;
    return this;
  }
  /**
   * Starts the assets bundler server. The assets bundler server process is
   * considered as the secondary process and therefore we do not perform
   * any cleanup if it dies.
   */
  start() {
    if (!this.#options?.enabled) {
      return;
    }
    this.#logger.info(`starting "${this.#options.driver}" dev server...`);
    this.#devServer = run(this.#cwd, {
      script: this.#options.cmd,
      reject: true,
      /**
       * We do not inherit the stdio for vite and encore, because in
       * inherit mode they own the stdin and interrupts the
       * `Ctrl + C` command.
       */
      stdio: "pipe",
      scriptArgs: this.#options.args
    });
    this.#devServer.stdout?.on("data", (data) => {
      if (this.#options.driver === "vite") {
        this.#logViteDevServerMessage(data);
      } else {
        this.#logAssetsDevServerMessage(data);
      }
    });
    this.#devServer.stderr?.on("data", (data) => {
      if (this.#options.driver === "vite") {
        this.#logViteDevServerMessage(data);
      } else {
        this.#logAssetsDevServerMessage(data);
      }
    });
    this.#devServer.then((result) => {
      this.#logger.warning(
        `"${this.#options.driver}" dev server closed with status code "${result.exitCode}"`
      );
    }).catch((error) => {
      this.#logger.warning(`unable to connect to "${this.#options.driver}" dev server`);
      this.#logger.fatal(error);
    });
  }
  /**
   * Stop the dev server
   */
  stop() {
    if (this.#devServer) {
      this.#devServer.removeAllListeners();
      this.#devServer.kill("SIGKILL");
      this.#devServer = void 0;
    }
  }
};

// src/dev_server.ts
var ui3 = cliui3();
var DevServer = class {
  #cwd;
  #logger = ui3.logger;
  #options;
  /**
   * Flag to know if the dev server is running in watch
   * mode
   */
  #isWatching = false;
  /**
   * Script file to start the development server
   */
  #scriptFile = "bin/server.js";
  /**
   * Picomatch matcher function to know if a file path is a
   * meta file with reloadServer option enabled
   */
  #isMetaFileWithReloadsEnabled;
  /**
   * Picomatch matcher function to know if a file path is a
   * meta file with reloadServer option disabled
   */
  #isMetaFileWithReloadsDisabled;
  /**
   * External listeners that are invoked when child process
   * gets an error or closes
   */
  #onError;
  #onClose;
  /**
   * Reference to the child process
   */
  #httpServer;
  /**
   * Reference to the watcher
   */
  #watcher;
  /**
   * Reference to the assets server
   */
  #assetsServer;
  /**
   * Hooks to execute custom actions during the dev server lifecycle
   */
  #hooks;
  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors();
  }
  constructor(cwd, options) {
    this.#cwd = cwd;
    this.#options = options;
    this.#hooks = new AssemblerHooks(options.hooks);
    if (this.#options.hmr) {
      this.#options.nodeArgs = this.#options.nodeArgs.concat(["--import=hot-hook/register"]);
    }
    this.#isMetaFileWithReloadsEnabled = picomatch(
      (this.#options.metaFiles || []).filter(({ reloadServer }) => reloadServer === true).map(({ pattern }) => pattern)
    );
    this.#isMetaFileWithReloadsDisabled = picomatch(
      (this.#options.metaFiles || []).filter(({ reloadServer }) => reloadServer !== true).map(({ pattern }) => pattern)
    );
  }
  /**
   * Inspect if child process message is from AdonisJS HTTP server
   */
  #isAdonisJSReadyMessage(message) {
    return message !== null && typeof message === "object" && "isAdonisJS" in message && "environment" in message && message.environment === "web";
  }
  /**
   * Inspect if child process message is coming from Hot Hook
   */
  #isHotHookMessage(message) {
    return message !== null && typeof message === "object" && "type" in message && typeof message.type === "string" && message.type.startsWith("hot-hook:");
  }
  /**
   * Conditionally clear the terminal screen
   */
  #clearScreen() {
    if (this.#options.clearScreen) {
      process.stdout.write("\x1Bc");
    }
  }
  /**
   * Starts the HTTP server
   */
  #startHTTPServer(port, mode) {
    const hooksArgs = { colors: this.#colors, logger: this.#logger };
    this.#httpServer = runNode(this.#cwd, {
      script: this.#scriptFile,
      env: { PORT: port, ...this.#options.env },
      nodeArgs: this.#options.nodeArgs,
      reject: true,
      scriptArgs: this.#options.scriptArgs
    });
    this.#httpServer.on("message", async (message) => {
      if (this.#isHotHookMessage(message)) {
        const path = relative3(fileURLToPath3(this.#cwd), message.path || message.paths?.[0]);
        this.#hooks.onSourceFileChanged(hooksArgs, path);
        if (message.type === "hot-hook:full-reload") {
          this.#clearScreen();
          this.#logger.log(`${this.#colors.green("full-reload")} ${path}`);
          this.#restartHTTPServer(port);
          this.#hooks.onDevServerStarted(hooksArgs);
        } else if (message.type === "hot-hook:invalidated") {
          this.#logger.log(`${this.#colors.green("invalidated")} ${path}`);
        }
      }
      if (this.#isAdonisJSReadyMessage(message)) {
        const host = message.host === "0.0.0.0" ? "127.0.0.1" : message.host;
        const displayMessage = ui3.sticker().useColors(this.#colors).useRenderer(this.#logger.getRenderer()).add(`Server address: ${this.#colors.cyan(`http://${host}:${message.port}`)}`);
        const watchMode = this.#options.hmr ? "HMR" : this.#isWatching ? "Legacy" : "None";
        displayMessage.add(`Watch Mode: ${this.#colors.cyan(watchMode)}`);
        if (message.duration) {
          displayMessage.add(`Ready in: ${this.#colors.cyan(prettyHrtime(message.duration))}`);
        }
        displayMessage.render();
        await this.#hooks.onDevServerStarted({ colors: ui3.colors, logger: this.#logger });
      }
    });
    this.#httpServer.then((result) => {
      if (mode === "nonblocking") {
        this.#onClose?.(result.exitCode);
        this.#watcher?.close();
        this.#assetsServer?.stop();
      } else {
        this.#logger.info("Underlying HTTP server closed. Still watching for changes");
      }
    }).catch((error) => {
      if (mode === "nonblocking") {
        this.#onError?.(error);
        this.#watcher?.close();
        this.#assetsServer?.stop();
      } else {
        this.#logger.info("Underlying HTTP server died. Still watching for changes");
      }
    });
  }
  /**
   * Starts the assets server
   */
  #startAssetsServer() {
    this.#assetsServer = new AssetsDevServer(this.#cwd, this.#options.assets);
    this.#assetsServer.setLogger(this.#logger);
    this.#assetsServer.start();
  }
  /**
   * Restarts the HTTP server in the watch mode. Do not call this
   * method when not in watch mode
   */
  #restartHTTPServer(port) {
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners();
      this.#httpServer.kill("SIGKILL");
    }
    this.#startHTTPServer(port, "blocking");
  }
  /**
   * Handles a non TypeScript file change
   */
  #handleFileChange(action, port, relativePath) {
    if (isDotEnvFile(relativePath)) {
      this.#clearScreen();
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`);
      this.#restartHTTPServer(port);
      return;
    }
    if (this.#isMetaFileWithReloadsEnabled(relativePath)) {
      this.#clearScreen();
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`);
      this.#restartHTTPServer(port);
      return;
    }
    if (this.#isMetaFileWithReloadsDisabled(relativePath)) {
      this.#clearScreen();
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`);
    }
  }
  /**
   * Handles TypeScript source file change
   */
  async #handleSourceFileChange(action, port, relativePath) {
    await this.#hooks.onSourceFileChanged({ colors: ui3.colors, logger: this.#logger }, relativePath);
    this.#clearScreen();
    this.#logger.log(`${this.#colors.green(action)} ${relativePath}`);
    this.#restartHTTPServer(port);
  }
  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger) {
    this.#logger = logger;
    this.#assetsServer?.setLogger(logger);
    return this;
  }
  /**
   * Add listener to get notified when dev server is
   * closed
   */
  onClose(callback) {
    this.#onClose = callback;
    return this;
  }
  /**
   * Add listener to get notified when dev server exists
   * with an error
   */
  onError(callback) {
    this.#onError = callback;
    return this;
  }
  /**
   * Close watchers and running child processes
   */
  async close() {
    await this.#watcher?.close();
    this.#assetsServer?.stop();
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners();
      this.#httpServer.kill("SIGKILL");
    }
  }
  /**
   * Start the development server
   */
  async start() {
    await this.#hooks.registerDevServerHooks();
    this.#clearScreen();
    this.#logger.info("starting HTTP server...");
    this.#startHTTPServer(String(await getPort(this.#cwd)), "nonblocking");
    this.#startAssetsServer();
  }
  /**
   * Start the development server in watch mode
   */
  async startAndWatch(ts, options) {
    await this.#hooks.registerDevServerHooks();
    const port = String(await getPort(this.#cwd));
    this.#isWatching = true;
    this.#clearScreen();
    this.#logger.info("starting HTTP server...");
    this.#startHTTPServer(port, "blocking");
    this.#startAssetsServer();
    const output = watch(this.#cwd, ts, options || {});
    if (!output) {
      this.#onClose?.(1);
      return;
    }
    this.#watcher = output.chokidar;
    output.watcher.on("watcher:ready", () => {
      this.#logger.info("watching file system for changes...");
    });
    output.chokidar.on("error", (error) => {
      this.#logger.warning("file system watcher failure");
      this.#logger.fatal(error);
      this.#onError?.(error);
      output.chokidar.close();
    });
    output.watcher.on(
      "source:add",
      ({ relativePath }) => this.#handleSourceFileChange("add", port, relativePath)
    );
    output.watcher.on(
      "source:change",
      ({ relativePath }) => this.#handleSourceFileChange("update", port, relativePath)
    );
    output.watcher.on(
      "source:unlink",
      ({ relativePath }) => this.#handleSourceFileChange("delete", port, relativePath)
    );
    output.watcher.on(
      "add",
      ({ relativePath }) => this.#handleFileChange("add", port, relativePath)
    );
    output.watcher.on(
      "change",
      ({ relativePath }) => this.#handleFileChange("update", port, relativePath)
    );
    output.watcher.on(
      "unlink",
      ({ relativePath }) => this.#handleFileChange("delete", port, relativePath)
    );
  }
};

// src/test_runner.ts
import picomatch2 from "picomatch";
import { cliui as cliui4 } from "@poppinss/cliui";
var ui4 = cliui4();
var TestRunner = class {
  #cwd;
  #logger = ui4.logger;
  #options;
  /**
   * The script file to run as a child process
   */
  #scriptFile = "bin/test.js";
  /**
   * Pico matcher function to check if the filepath is
   * part of the `metaFiles` glob patterns
   */
  #isMetaFile;
  /**
   * Pico matcher function to check if the filepath is
   * part of a test file.
   */
  #isTestFile;
  /**
   * Arguments to pass to the "bin/test.js" file.
   */
  #scriptArgs;
  /**
   * Set of initial filters applied when running the test
   * command. In watch mode, we will append an additional
   * filter to run tests only for the file that has been
   * changed.
   */
  #initialFiltersArgs;
  /**
   * In watch mode, after a file is changed, we wait for the current
   * set of tests to finish before triggering a re-run. Therefore,
   * we use this flag to know if we are already busy in running
   * tests and ignore file-changes.
   */
  #isBusy = false;
  /**
   * External listeners that are invoked when child process
   * gets an error or closes
   */
  #onError;
  #onClose;
  /**
   * Reference to the test script child process
   */
  #testScript;
  /**
   * Reference to the watcher
   */
  #watcher;
  /**
   * Reference to the assets server
   */
  #assetsServer;
  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors();
  }
  constructor(cwd, options) {
    this.#cwd = cwd;
    this.#options = options;
    this.#isMetaFile = picomatch2((this.#options.metaFiles || []).map(({ pattern }) => pattern));
    this.#isTestFile = picomatch2(
      this.#options.suites.filter((suite) => {
        if (this.#options.filters.suites) {
          return this.#options.filters.suites.includes(suite.name);
        }
        return true;
      }).map((suite) => suite.files).flat(1)
    );
    this.#scriptArgs = this.#convertOptionsToArgs().concat(this.#options.scriptArgs);
    this.#initialFiltersArgs = this.#convertFiltersToArgs(this.#options.filters);
  }
  /**
   * Convert test runner options to the CLI args
   */
  #convertOptionsToArgs() {
    const args = [];
    if (this.#options.reporters) {
      args.push("--reporters");
      args.push(this.#options.reporters.join(","));
    }
    if (this.#options.timeout !== void 0) {
      args.push("--timeout");
      args.push(String(this.#options.timeout));
    }
    if (this.#options.failed) {
      args.push("--failed");
    }
    if (this.#options.retries !== void 0) {
      args.push("--retries");
      args.push(String(this.#options.retries));
    }
    return args;
  }
  /**
   * Converts all known filters to CLI args.
   *
   * The following code snippet may seem like repetitive code. But, it
   * is done intentionally to have visibility around how each filter
   * is converted to an arg.
   */
  #convertFiltersToArgs(filters) {
    const args = [];
    if (filters.suites) {
      args.push(...filters.suites);
    }
    if (filters.files) {
      args.push("--files");
      args.push(filters.files.join(","));
    }
    if (filters.groups) {
      args.push("--groups");
      args.push(filters.groups.join(","));
    }
    if (filters.tags) {
      args.push("--tags");
      args.push(filters.tags.join(","));
    }
    if (filters.tests) {
      args.push("--tests");
      args.push(filters.tests.join(","));
    }
    return args;
  }
  /**
   * Conditionally clear the terminal screen
   */
  #clearScreen() {
    if (this.#options.clearScreen) {
      process.stdout.write("\x1Bc");
    }
  }
  /**
   * Runs tests
   */
  #runTests(port, mode, filters) {
    this.#isBusy = true;
    const scriptArgs = filters ? this.#convertFiltersToArgs(filters).concat(this.#scriptArgs) : this.#initialFiltersArgs.concat(this.#scriptArgs);
    this.#testScript = runNode(this.#cwd, {
      script: this.#scriptFile,
      reject: true,
      env: { PORT: port, ...this.#options.env },
      nodeArgs: this.#options.nodeArgs,
      scriptArgs
    });
    this.#testScript.then((result) => {
      if (mode === "nonblocking") {
        this.#onClose?.(result.exitCode);
        this.close();
      }
    }).catch((error) => {
      if (mode === "nonblocking") {
        this.#onError?.(error);
        this.close();
      }
    }).finally(() => {
      this.#isBusy = false;
    });
  }
  /**
   * Re-run tests with additional inline filters. Should be
   * executed in watch mode only.
   */
  #rerunTests(port, filters) {
    if (this.#testScript) {
      this.#testScript.removeAllListeners();
      this.#testScript.kill("SIGKILL");
    }
    this.#runTests(port, "blocking", filters);
  }
  /**
   * Starts the assets server
   */
  #startAssetsServer() {
    this.#assetsServer = new AssetsDevServer(this.#cwd, this.#options.assets);
    this.#assetsServer.setLogger(this.#logger);
    this.#assetsServer.start();
  }
  /**
   * Handles a non TypeScript file change
   */
  #handleFileChange(action, port, relativePath) {
    if (this.#isBusy) {
      return;
    }
    if (isDotEnvFile(relativePath) || this.#isMetaFile(relativePath)) {
      this.#clearScreen();
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`);
      this.#rerunTests(port);
    }
  }
  /**
   * Handles TypeScript source file change
   */
  #handleSourceFileChange(action, port, relativePath) {
    if (this.#isBusy) {
      return;
    }
    this.#clearScreen();
    this.#logger.log(`${this.#colors.green(action)} ${relativePath}`);
    if (this.#isTestFile(relativePath)) {
      this.#rerunTests(port, {
        ...this.#options.filters,
        files: [relativePath]
      });
      return;
    }
    this.#rerunTests(port);
  }
  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger) {
    this.#logger = logger;
    this.#assetsServer?.setLogger(logger);
    return this;
  }
  /**
   * Add listener to get notified when dev server is
   * closed
   */
  onClose(callback) {
    this.#onClose = callback;
    return this;
  }
  /**
   * Add listener to get notified when dev server exists
   * with an error
   */
  onError(callback) {
    this.#onError = callback;
    return this;
  }
  /**
   * Close watchers and running child processes
   */
  async close() {
    await this.#watcher?.close();
    this.#assetsServer?.stop();
    if (this.#testScript) {
      this.#testScript.removeAllListeners();
      this.#testScript.kill("SIGKILL");
    }
  }
  /**
   * Runs tests
   */
  async run() {
    const port = String(await getPort(this.#cwd));
    this.#clearScreen();
    this.#startAssetsServer();
    this.#logger.info("booting application to run tests...");
    this.#runTests(port, "nonblocking");
  }
  /**
   * Run tests in watch mode
   */
  async runAndWatch(ts, options) {
    const port = String(await getPort(this.#cwd));
    this.#clearScreen();
    this.#startAssetsServer();
    this.#logger.info("booting application to run tests...");
    this.#runTests(port, "blocking");
    const output = watch(this.#cwd, ts, options || {});
    if (!output) {
      this.#onClose?.(1);
      return;
    }
    this.#watcher = output.chokidar;
    output.watcher.on("watcher:ready", () => {
      this.#logger.info("watching file system for changes...");
    });
    output.chokidar.on("error", (error) => {
      this.#logger.warning("file system watcher failure");
      this.#logger.fatal(error);
      this.#onError?.(error);
      output.chokidar.close();
    });
    output.watcher.on(
      "source:add",
      ({ relativePath }) => this.#handleSourceFileChange("add", port, relativePath)
    );
    output.watcher.on(
      "source:change",
      ({ relativePath }) => this.#handleSourceFileChange("update", port, relativePath)
    );
    output.watcher.on(
      "source:unlink",
      ({ relativePath }) => this.#handleSourceFileChange("delete", port, relativePath)
    );
    output.watcher.on(
      "add",
      ({ relativePath }) => this.#handleFileChange("add", port, relativePath)
    );
    output.watcher.on(
      "change",
      ({ relativePath }) => this.#handleFileChange("update", port, relativePath)
    );
    output.watcher.on(
      "unlink",
      ({ relativePath }) => this.#handleFileChange("delete", port, relativePath)
    );
  }
};
export {
  Bundler,
  DevServer,
  TestRunner
};
//# sourceMappingURL=index.js.map