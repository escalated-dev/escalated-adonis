// src/repl.ts
import stringWidth from "string-width";
import useColors from "@poppinss/colors";
import { inspect, promisify as utilPromisify } from "util";
import { Recoverable, start as startRepl } from "repl";
var GLOBAL_NODE_PROPERTIES = [
  "performance",
  "global",
  "clearInterval",
  "clearTimeout",
  "setInterval",
  "setTimeout",
  "queueMicrotask",
  "clearImmediate",
  "setImmediate",
  "structuredClone",
  "atob",
  "btoa",
  "fetch",
  "crypto",
  "navigator"
];
var TS_UTILS_HELPERS = [
  "__extends",
  "__assign",
  "__rest",
  "__decorate",
  "__param",
  "__esDecorate",
  "__runInitializers",
  "__propKey",
  "__setFunctionName",
  "__metadata",
  "__awaiter",
  "__generator",
  "__exportStar",
  "__createBinding",
  "__values",
  "__read",
  "__spread",
  "__spreadArrays",
  "__spreadArray",
  "__await",
  "__asyncGenerator",
  "__asyncDelegator",
  "__asyncValues",
  "__makeTemplateObject",
  "__importStar",
  "__importDefault",
  "__classPrivateFieldGet",
  "__classPrivateFieldSet",
  "__classPrivateFieldIn"
];
var Repl = class {
  #replOptions;
  /**
   * Length of the longest custom method name. We need to show a
   * symmetric view of custom methods and their description
   */
  #longestCustomMethodName = 0;
  /**
   * Reference to the original `eval` method of the repl server.
   * Since we are monkey patching it, we need a reference to it
   * to call it after our custom logic
   */
  #originalEval;
  /**
   * Compiler that will transform the user input just
   * before evaluation
   */
  #compiler;
  /**
   * Path to the history file
   */
  #historyFilePath;
  /**
   * Set of registered ready callbacks
   */
  #onReadyCallbacks = [];
  /**
   * A set of registered custom methods
   */
  #customMethods = {};
  /**
   * Colors reference
   */
  colors = useColors.ansi();
  /**
   * Reference to the repl server. Available after the `start` method
   * is invoked
   */
  server;
  constructor(options) {
    const { compiler, historyFilePath, ...rest } = options || {};
    this.#compiler = compiler;
    this.#historyFilePath = historyFilePath;
    this.#replOptions = rest;
  }
  /**
   * Registering custom methods with the server context by wrapping
   * them inside a function and passes the REPL server instance
   * to the method
   */
  #registerCustomMethodWithContext(name) {
    const customMethod = this.#customMethods[name];
    if (!customMethod) {
      return;
    }
    const handler = (...args) => customMethod.handler(this, ...args);
    Object.defineProperty(handler, "name", { value: customMethod.handler.name });
    this.server.context[name] = handler;
  }
  /**
   * Setup context with default globals
   */
  #setupContext() {
    this.addMethod(
      "clear",
      function clear(repl, key) {
        if (!key) {
          console.log(repl.colors.red("Define a property name to remove from the context"));
        } else {
          delete repl.server.context[key];
        }
        repl.server.displayPrompt();
      },
      {
        description: "Clear a property from the REPL context",
        usage: `clear ${this.colors.gray("(propertyName)")}`
      }
    );
    this.addMethod(
      "p",
      function promisify(_, fn) {
        return utilPromisify(fn);
      },
      {
        description: 'Promisify a function. Similar to Node.js "util.promisify"',
        usage: `p ${this.colors.gray("(function)")}`
      }
    );
    Object.keys(this.#customMethods).forEach((name) => {
      this.#registerCustomMethodWithContext(name);
    });
  }
  /**
   * Find if the error is recoverable or not
   */
  #isRecoverableError(error) {
    return /^(Unexpected end of input|Unexpected token|' expected)/.test(error.message);
  }
  /**
   * Custom eval method to execute the user code
   *
   * Basically we are monkey patching the original eval method, because
   * we want to:
   * - Compile the user code before executing it
   * - And also benefit from the original eval method that supports
   *   cool features like top level await
   */
  #eval(code, context, filename, callback) {
    try {
      const compiled = this.#compiler ? this.#compiler.compile(code, filename) : code;
      return this.#originalEval(compiled, context, filename, callback);
    } catch (error) {
      if (this.#isRecoverableError(error)) {
        callback(new Recoverable(error), null);
        return;
      }
      callback(error, null);
    }
  }
  /**
   * Setup history file
   */
  #setupHistory() {
    if (!this.#historyFilePath) {
      return;
    }
    this.server.setupHistory(this.#historyFilePath, (error) => {
      if (!error) {
        return;
      }
      console.log(this.colors.red("Unable to write to the history file. Exiting"));
      console.error(error);
      process.exit(1);
    });
  }
  /**
   * Prints the help for the context properties
   */
  #printContextHelp() {
    console.log("");
    console.log(this.colors.green("CONTEXT PROPERTIES/METHODS:"));
    const context = Object.keys(this.server.context).reduce(
      (result, key) => {
        if (!this.#customMethods[key] && !GLOBAL_NODE_PROPERTIES.includes(key) && !TS_UTILS_HELPERS.includes(key)) {
          result[key] = this.server.context[key];
        }
        return result;
      },
      {}
    );
    console.log(inspect(context, false, 1, true));
  }
  /**
   * Prints the help for the custom methods
   */
  #printCustomMethodsHelp() {
    console.log("");
    console.log(this.colors.green("GLOBAL METHODS:"));
    Object.keys(this.#customMethods).forEach((method) => {
      const { options } = this.#customMethods[method];
      const usage = this.colors.yellow(options.usage || method);
      const spaces = " ".repeat(this.#longestCustomMethodName - options.width + 2);
      const description = this.colors.dim(options.description || "");
      console.log(`${usage}${spaces}${description}`);
    });
  }
  /**
   * Prints the context to the console
   */
  #ls() {
    this.#printCustomMethodsHelp();
    this.#printContextHelp();
    this.server.displayPrompt();
  }
  /**
   * Notify by writing to the console
   */
  notify(message) {
    console.log(this.colors.yellow().italic(message));
    if (this.server) {
      this.server.displayPrompt();
    }
  }
  /**
   * Register a callback to be invoked once the server is ready
   */
  ready(callback) {
    this.#onReadyCallbacks.push(callback);
    return this;
  }
  /**
   * Register a custom loader function to be added to the context
   */
  addMethod(name, handler, options) {
    const width = stringWidth(options?.usage || name);
    if (width > this.#longestCustomMethodName) {
      this.#longestCustomMethodName = width;
    }
    this.#customMethods[name] = { handler, options: Object.assign({ width }, options) };
    if (this.server) {
      this.#registerCustomMethodWithContext(name);
    }
    return this;
  }
  /**
   * Returns the collection of registered methods
   */
  getMethods() {
    return this.#customMethods;
  }
  /**
   * Register a compiler. Make sure register the compiler before
   * calling the start method
   */
  useCompiler(compiler) {
    this.#compiler = compiler;
    return this;
  }
  /**
   * Start the REPL server
   */
  start(context) {
    console.log("");
    this.notify('Type ".ls" to a view list of available context methods/properties');
    this.server = startRepl({
      prompt: `> ${this.#compiler?.supportsTypescript ? "(ts) " : "(js) "}`,
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdout.isTTY && !Number.parseInt(process.env.NODE_NO_READLINE, 10),
      useGlobal: true,
      ...this.#replOptions
    });
    if (context) {
      Object.keys(context).forEach((key) => {
        this.server.context[key] = context[key];
      });
    }
    this.server.defineCommand("ls", {
      help: "View list of available context methods/properties",
      action: this.#ls.bind(this)
    });
    this.#setupContext();
    this.#setupHistory();
    this.#originalEval = this.server.eval;
    this.server.eval = this.#eval.bind(this);
    this.server.displayPrompt();
    this.#onReadyCallbacks.forEach((callback) => callback(this));
    return this;
  }
};
export {
  Repl
};
