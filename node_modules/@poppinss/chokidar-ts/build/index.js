// src/watcher.ts
import slash2 from "slash";
import Emittery from "emittery";
import { join as join2 } from "path";
import chokidar from "chokidar";

// src/debug.ts
import { debuglog } from "util";
var debug_default = debuglog("chokidar:ts");

// src/source_files_manager.ts
import slash from "slash";
import memoize from "memoize";
import { join } from "path";
import picomatch from "picomatch";
var SourceFilesManager = class {
  #appRoot;
  #included;
  #excluded;
  /**
   * A collection of project files collected as part of the first scan.
   */
  #projectFiles = {};
  /**
   * A memoized function to match the file path against included and excluded
   * picomatch patterns
   */
  #matchAgainstPattern = memoize((filePath) => {
    if (!this.#included(filePath)) {
      debug_default("file rejected by includes %s", filePath);
      return false;
    }
    if (this.#excluded(filePath)) {
      debug_default("file rejected by excludes %s", filePath);
      return false;
    }
    return true;
  });
  constructor(appRoot, options) {
    this.#appRoot = slash(appRoot).replace(/\/$/, "");
    options.files.forEach((file) => this.add(file));
    this.#included = picomatch(
      (options.includes || []).map((pattern) => {
        return slash(join(this.#appRoot, pattern));
      })
    );
    this.#excluded = picomatch(
      (options.excludes || []).map((pattern) => {
        return slash(join(this.#appRoot, pattern));
      })
    );
  }
  /**
   * Track a new source file
   */
  add(filePath) {
    filePath = slash(filePath);
    this.#projectFiles[filePath] = true;
    debug_default('adding new source file "%s"', filePath);
  }
  /**
   * Remove file from the list of existing source files
   */
  remove(filePath) {
    filePath = slash(filePath);
    debug_default('removing source file "%s"', filePath);
    delete this.#projectFiles[filePath];
  }
  /**
   * Returns true when filePath is part of the source files after checking
   * them against `includes`, `excludes` and custom set of `files`.
   */
  isSourceFile(filePath) {
    debug_default("matching for watched file %s", filePath);
    filePath = slash(filePath);
    return !!this.#projectFiles[filePath] || this.#matchAgainstPattern(filePath);
  }
  /**
   * Returns true if the file should be watched
   */
  shouldWatch(filePath) {
    if (filePath === this.#appRoot) {
      return true;
    }
    return this.isSourceFile(filePath);
  }
  /**
   * Returns a copy of project source files
   */
  toJSON() {
    return this.#projectFiles;
  }
};

// src/watcher.ts
var DEFAULT_INCLUDES = ["**/*"];
var ALWAYS_EXCLUDE = [".git/**", "coverage/**", ".github/**"];
var DEFAULT_EXCLUDES = ["node_modules/**", "bower_components/**", "jspm_packages/**"];
var Watcher = class extends Emittery {
  #cwd;
  #config;
  #sourceFilesManager;
  constructor(cwd, config) {
    const outDir = config.raw.compilerOptions?.outDir;
    const includes = config.raw.include || DEFAULT_INCLUDES;
    const excludes = ALWAYS_EXCLUDE.concat(
      config.raw.exclude || (outDir ? DEFAULT_EXCLUDES.concat(outDir) : DEFAULT_EXCLUDES)
    );
    debug_default("initiating watcher %O", {
      includes,
      excludes,
      outDir,
      files: config.fileNames
    });
    super();
    this.#cwd = cwd;
    this.#config = config;
    this.#sourceFilesManager = new SourceFilesManager(this.#cwd, {
      includes,
      excludes,
      files: config.fileNames
    });
  }
  /**
   * Returns a boolean telling if it is a script file or not.
   *
   * We check for the `compilerOptions.allowJs` before marking
   * `.js` files as a script files.
   */
  #isScriptFile(filePath) {
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      return true;
    }
    if (this.#config.options.allowJs && filePath.endsWith(".js")) {
      return true;
    }
    return false;
  }
  /**
   * Initiates chokidar watcher
   */
  #initiateWatcher(watchPattern = ["."], watcherOptions) {
    watcherOptions = Object.assign(
      {
        ignored: (filePath) => {
          return !this.#sourceFilesManager.shouldWatch(filePath);
        },
        cwd: this.#cwd,
        ignoreInitial: true
      },
      watcherOptions
    );
    debug_default("initating watcher with %j options", watcherOptions);
    return chokidar.watch(watchPattern, watcherOptions);
  }
  /**
   * Invoked when chokidar notifies for a new file addtion
   */
  #onNewFile(filePath) {
    const absPath = join2(this.#cwd, filePath);
    if (!this.#isScriptFile(filePath) || !this.#sourceFilesManager.isSourceFile(absPath)) {
      debug_default('new file added "%s"', filePath);
      this.emit("add", { relativePath: slash2(filePath), absPath });
      return;
    }
    debug_default('new source file added "%s"', filePath);
    this.#sourceFilesManager.add(absPath);
    this.emit("source:add", { relativePath: slash2(filePath), absPath });
  }
  /**
   * Invoked when chokidar notifies for changes the existing
   * source file
   */
  #onChange(filePath) {
    const absPath = join2(this.#cwd, filePath);
    if (!this.#isScriptFile(filePath) || !this.#sourceFilesManager.isSourceFile(absPath)) {
      debug_default('file changed "%s"', filePath);
      this.emit("change", { relativePath: slash2(filePath), absPath });
      return;
    }
    debug_default('source file changed "%s"', filePath);
    this.emit("source:change", { relativePath: slash2(filePath), absPath });
  }
  /**
   * Invoked when chokidar notifies for file deletion
   */
  #onRemove(filePath) {
    const absPath = join2(this.#cwd, filePath);
    if (!this.#isScriptFile(filePath) || !this.#sourceFilesManager.isSourceFile(absPath)) {
      debug_default('file removed "%s"', filePath);
      this.emit("unlink", { relativePath: slash2(filePath), absPath });
      return;
    }
    debug_default('source file removed "%s"', filePath);
    this.#sourceFilesManager.remove(absPath);
    this.emit("source:unlink", { relativePath: slash2(filePath), absPath });
  }
  /**
   * Build and watch project for changes
   */
  watch(watchPattern = ["."], watcherOptions) {
    const watcher = this.#initiateWatcher(watchPattern, watcherOptions);
    watcher.on("ready", () => {
      debug_default("watcher ready");
      this.emit("watcher:ready");
    });
    watcher.on("add", (path) => this.#onNewFile(path));
    watcher.on("change", (path) => this.#onChange(path));
    watcher.on("unlink", (path) => this.#onRemove(path));
    return watcher;
  }
};

// src/config_parser.ts
import { join as join3 } from "path";
import { fileURLToPath } from "url";
var ConfigParser = class {
  #cwd;
  #configFileName;
  #ts;
  constructor(cwd, configFileName, ts) {
    this.#cwd = typeof cwd === "string" ? cwd : fileURLToPath(cwd);
    this.#configFileName = configFileName;
    this.#ts = ts;
  }
  /**
   * Parse file. The errors the return back inside the `error` property
   */
  parse(optionsToExtend) {
    let hardException = null;
    debug_default('parsing config file "%s"', this.#configFileName);
    const parsedConfig = this.#ts.getParsedCommandLineOfConfigFile(
      join3(this.#cwd, this.#configFileName),
      optionsToExtend || {},
      {
        ...this.#ts.sys,
        useCaseSensitiveFileNames: true,
        getCurrentDirectory: () => this.#cwd,
        onUnRecoverableConfigFileDiagnostic: (error) => hardException = error
      }
    );
    return { config: parsedConfig, error: hardException };
  }
};
export {
  ConfigParser,
  SourceFilesManager,
  Watcher
};
