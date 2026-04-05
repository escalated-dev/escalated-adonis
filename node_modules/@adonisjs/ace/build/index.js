var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// src/parser.ts
import yargsParser from "yargs-parser";

// src/yars_config.ts
var yarsConfig = {
  "camel-case-expansion": false,
  "combine-arrays": true,
  "short-option-groups": true,
  "dot-notation": false,
  "parse-numbers": true,
  "parse-positional-numbers": false,
  "boolean-negation": true,
  "flatten-duplicate-arrays": true,
  "greedy-arrays": false,
  "strip-aliased": true,
  "nargs-eats-options": false,
  "unknown-options-as-args": false
};

// src/parser.ts
var Parser = class {
  /**
   * Parser options
   */
  #options;
  constructor(options) {
    this.#options = options;
  }
  /**
   * Parsers flags using yargs
   */
  #parseFlags(argv) {
    return yargsParser(argv, { ...this.#options.flagsParserOptions, configuration: yarsConfig });
  }
  /**
   * Scans for unknown flags in yargs output.
   */
  #scanUnknownFlags(parsed) {
    const unknownFlags = [];
    for (let key of Object.keys(parsed)) {
      if (!this.#options.flagsParserOptions.all.includes(key)) {
        unknownFlags.push(key);
      }
    }
    return unknownFlags;
  }
  /**
   * Parsers arguments by mimicking the yargs behavior
   */
  #parseArguments(parsedOutput) {
    let lastParsedIndex = -1;
    const output = this.#options.argumentsParserOptions.map((option, index) => {
      if (option.type === "spread") {
        let value2 = parsedOutput._.slice(index);
        lastParsedIndex = parsedOutput._.length;
        if (!value2.length) {
          value2 = Array.isArray(option.default) ? option.default : option.default === void 0 ? void 0 : [option.default];
        }
        if (value2 !== void 0 && option.parse) {
          value2 = option.parse(value2);
        }
        return value2;
      }
      let value = parsedOutput._[index];
      lastParsedIndex = index + 1;
      if (value === void 0) {
        value = option.default;
      }
      if (value !== void 0 && option.parse) {
        value = option.parse(value);
      }
      return value;
    });
    const { "_": args2, "--": o, ...rest } = parsedOutput;
    return {
      args: output,
      nodeArgs: [],
      _: args2.slice(lastParsedIndex === -1 ? 0 : lastParsedIndex),
      unknownFlags: this.#scanUnknownFlags(rest),
      flags: rest
    };
  }
  /**
   * Parse commandline arguments
   */
  parse(argv) {
    return this.#parseArguments(this.#parseFlags(argv));
  }
};

// src/kernel.ts
import Hooks from "@poppinss/hooks";
import { cliui } from "@poppinss/cliui";
import { Prompt } from "@poppinss/prompts";
import { distance } from "fastest-levenshtein";
import { RuntimeException as RuntimeException2 } from "@poppinss/utils";

// src/debug.ts
import { debuglog } from "util";
var debug_default = debuglog("adonisjs:ace");

// src/errors.ts
var errors_exports = {};
__export(errors_exports, {
  E_COMMAND_NOT_FOUND: () => E_COMMAND_NOT_FOUND,
  E_INVALID_FLAG: () => E_INVALID_FLAG,
  E_MISSING_ARG: () => E_MISSING_ARG,
  E_MISSING_ARG_VALUE: () => E_MISSING_ARG_VALUE,
  E_MISSING_COMMAND_NAME: () => E_MISSING_COMMAND_NAME,
  E_MISSING_FLAG: () => E_MISSING_FLAG,
  E_MISSING_FLAG_VALUE: () => E_MISSING_FLAG_VALUE,
  E_PROMPT_CANCELLED: () => E_PROMPT_CANCELLED,
  E_UNKNOWN_FLAG: () => E_UNKNOWN_FLAG
});
import { errors } from "@poppinss/prompts";
import { createError, Exception } from "@poppinss/utils";
var E_PROMPT_CANCELLED = errors.E_PROMPT_CANCELLED;
var E_MISSING_COMMAND_NAME = createError(
  'Cannot serialize command "%s". Missing static property "commandName"',
  "E_MISSING_COMMAND_NAME"
);
var E_COMMAND_NOT_FOUND = class CommandNotFound extends Exception {
  static status = 404;
  commandName;
  constructor(args2) {
    super(`Command "${args2[0]}" is not defined`, { code: "E_COMMAND_NOT_FOUND" });
    this.commandName = args2[0];
  }
};
var E_MISSING_FLAG = createError(
  'Missing required option "%s"',
  "E_MISSING_FLAG"
);
var E_MISSING_FLAG_VALUE = createError(
  'Missing value for option "%s"',
  "E_MISSING_FLAG_VALUE"
);
var E_MISSING_ARG = createError(
  'Missing required argument "%s"',
  "E_MISSING_ARG"
);
var E_MISSING_ARG_VALUE = createError(
  'Missing value for argument "%s"',
  "E_MISSING_ARG_VALUE"
);
var E_UNKNOWN_FLAG = createError(
  'Unknown flag "%s". The mentioned flag is not accepted by the command',
  "E_UNKNOWN_FLAG"
);
var E_INVALID_FLAG = createError(
  'Invalid value. The "%s" flag accepts a "%s" value',
  "E_INVALID_FLAG"
);

// src/commands/base.ts
import { inspect } from "util";
import string from "@poppinss/utils/string";
import Macroable from "@poppinss/macroable";
import lodash from "@poppinss/utils/lodash";
import { AssertionError } from "assert";
import { defineStaticProperty, InvalidArgumentsException } from "@poppinss/utils";
var BaseCommand = class extends Macroable {
  constructor(kernel, parsed, ui, prompt) {
    super();
    this.kernel = kernel;
    this.parsed = parsed;
    this.ui = ui;
    this.prompt = prompt;
  }
  static booted = false;
  /**
   * Configuration options accepted by the command
   */
  static options;
  /**
   * A collection of aliases for the command
   */
  static aliases;
  /**
   * The command name one can type to run the command
   */
  static commandName;
  /**
   * The command description
   */
  static description;
  /**
   * The help text for the command. Help text can be a multiline
   * string explaining the usage of command
   */
  static help;
  /**
   * Registered arguments
   */
  static args;
  /**
   * Registered flags
   */
  static flags;
  /**
   * Define static properties on the class. During inheritance, certain
   * properties must inherit from the parent.
   */
  static boot() {
    if (Object.hasOwn(this, "booted") && this.booted === true) {
      return;
    }
    this.booted = true;
    defineStaticProperty(this, "args", { initialValue: [], strategy: "inherit" });
    defineStaticProperty(this, "flags", { initialValue: [], strategy: "inherit" });
    defineStaticProperty(this, "aliases", { initialValue: [], strategy: "inherit" });
    defineStaticProperty(this, "commandName", { initialValue: "", strategy: "inherit" });
    defineStaticProperty(this, "description", { initialValue: "", strategy: "inherit" });
    defineStaticProperty(this, "help", { initialValue: "", strategy: "inherit" });
    defineStaticProperty(this, "options", {
      initialValue: { staysAlive: false, allowUnknownFlags: false },
      strategy: "inherit"
    });
  }
  /**
   * Specify the argument the command accepts. The arguments via the CLI
   * will be accepted in the same order as they are defined.
   *
   * Mostly, you will be using the `@args` decorator to define the arguments.
   *
   * ```ts
   * Command.defineArgument('entity', { type: 'string' })
   * ```
   */
  static defineArgument(name, options) {
    this.boot();
    const arg = { name, argumentName: string.dashCase(name), required: true, ...options };
    const lastArg = this.args[this.args.length - 1];
    if (!arg.type) {
      throw new InvalidArgumentsException(
        `Cannot define argument "${this.name}.${name}". Specify the argument type`
      );
    }
    if (lastArg && lastArg.type === "spread") {
      throw new InvalidArgumentsException(
        `Cannot define argument "${this.name}.${name}" after spread argument "${this.name}.${lastArg.name}". Spread argument should be the last one`
      );
    }
    if (arg.required && lastArg && lastArg.required === false) {
      throw new InvalidArgumentsException(
        `Cannot define required argument "${this.name}.${name}" after optional argument "${this.name}.${lastArg.name}"`
      );
    }
    if (debug_default.enabled) {
      debug_default("defining arg %O, command: %O", arg, `[class: ${this.name}]`);
    }
    this.args.push(arg);
  }
  /**
   * Specify a flag the command accepts.
   *
   * Mostly, you will be using the `@flags` decorator to define a flag.
   *
   * ```ts
   * Command.defineFlag('connection', { type: 'string', required: true })
   * ```
   */
  static defineFlag(name, options) {
    this.boot();
    const flag = { name, flagName: string.dashCase(name), required: false, ...options };
    if (!flag.type) {
      throw new InvalidArgumentsException(
        `Cannot define flag "${this.name}.${name}". Specify the flag type`
      );
    }
    if (debug_default.enabled) {
      debug_default("defining flag %O, command: %O", flag, `[class: ${this.name}]`);
    }
    this.flags.push(flag);
  }
  /**
   * Returns the options for parsing flags and arguments
   */
  static getParserOptions(options) {
    this.boot();
    const argumentsParserOptions = this.args.map((arg) => {
      return {
        type: arg.type,
        default: arg.default,
        parse: arg.parse
      };
    });
    const flagsParserOptions = lodash.merge(
      {
        all: [],
        string: [],
        boolean: [],
        array: [],
        number: [],
        alias: {},
        count: [],
        coerce: {},
        default: {}
      },
      options
    );
    this.flags.forEach((flag) => {
      flagsParserOptions.all.push(flag.flagName);
      if (flag.alias) {
        flagsParserOptions.alias[flag.flagName] = flag.alias;
      }
      if (flag.parse) {
        flagsParserOptions.coerce[flag.flagName] = flag.parse;
      }
      if (flag.default !== void 0) {
        flagsParserOptions.default[flag.flagName] = flag.default;
      }
      switch (flag.type) {
        case "string":
          flagsParserOptions.string.push(flag.flagName);
          break;
        case "boolean":
          flagsParserOptions.boolean.push(flag.flagName);
          break;
        case "number":
          flagsParserOptions.number.push(flag.flagName);
          break;
        case "array":
          flagsParserOptions.array.push(flag.flagName);
          break;
      }
    });
    return {
      flagsParserOptions,
      argumentsParserOptions
    };
  }
  /**
   * Serializes the command to JSON. The return value satisfies the
   * {@link CommandMetaData}
   */
  static serialize() {
    this.boot();
    if (!this.commandName) {
      throw new E_MISSING_COMMAND_NAME([this.name]);
    }
    const [namespace, name] = this.commandName.split(":");
    return {
      commandName: this.commandName,
      description: this.description,
      help: this.help,
      namespace: name ? namespace : null,
      aliases: this.aliases,
      flags: this.flags.map((flag) => {
        const { parse, ...rest } = flag;
        return rest;
      }),
      args: this.args.map((arg) => {
        const { parse, ...rest } = arg;
        return rest;
      }),
      options: this.options
    };
  }
  /**
   * Validate the yargs parsed output againts the command.
   */
  static validate(parsedOutput) {
    this.boot();
    this.args.forEach((arg, index) => {
      const value = parsedOutput.args[index];
      const hasDefinedArgument = value !== void 0;
      if (arg.required && !hasDefinedArgument) {
        throw new E_MISSING_ARG([arg.name]);
      }
      if (hasDefinedArgument && !arg.allowEmptyValue && (value === "" || !value.length)) {
        if (debug_default.enabled) {
          debug_default('disallowing empty value "%s" for arg: "%s"', value, arg.name);
        }
        throw new E_MISSING_ARG_VALUE([arg.name]);
      }
    });
    if (!this.options.allowUnknownFlags && parsedOutput.unknownFlags.length) {
      const unknowFlag = parsedOutput.unknownFlags[0];
      const unknowFlagName = unknowFlag.length === 1 ? `-${unknowFlag}` : `--${unknowFlag}`;
      throw new E_UNKNOWN_FLAG([unknowFlagName]);
    }
    this.flags.forEach((flag) => {
      const hasMentionedFlag = Object.hasOwn(parsedOutput.flags, flag.flagName);
      const value = parsedOutput.flags[flag.flagName];
      switch (flag.type) {
        case "boolean":
          if (flag.required && !hasMentionedFlag) {
            throw new E_MISSING_FLAG([flag.flagName]);
          }
          break;
        case "number":
          if (flag.required && !hasMentionedFlag) {
            throw new E_MISSING_FLAG([flag.flagName]);
          }
          if (hasMentionedFlag && value === void 0) {
            throw new E_MISSING_FLAG_VALUE([flag.flagName]);
          }
          if (Number.isNaN(value)) {
            throw new E_INVALID_FLAG([flag.flagName, "numeric"]);
          }
          break;
        case "string":
        case "array":
          if (flag.required && !hasMentionedFlag) {
            throw new E_MISSING_FLAG([flag.flagName]);
          }
          if (hasMentionedFlag && !flag.allowEmptyValue && (value === "" || !value.length)) {
            if (debug_default.enabled) {
              debug_default('disallowing empty value "%s" for flag: "%s"', value, flag.name);
            }
            throw new E_MISSING_FLAG_VALUE([flag.flagName]);
          }
      }
    });
  }
  /**
   * Check if a command has been hypdrated
   */
  hydrated = false;
  /**
   * The exit code for the command
   */
  exitCode;
  /**
   * The error raised at the time of the executing the command.
   * The value is undefined if no error is raised.
   */
  error;
  /**
   * The result property stores the return value of the "run"
   * method (unless commands sets it explicitly)
   */
  result;
  /**
   * Logger to log messages
   */
  get logger() {
    return this.ui.logger;
  }
  /**
   * Add colors to console messages
   */
  get colors() {
    return this.ui.colors;
  }
  /**
   * Is the current command the main command executed from the
   * CLI
   */
  get isMain() {
    return this.kernel.getMainCommand() === this;
  }
  /**
   * Reference to the command name
   */
  get commandName() {
    return this.constructor.commandName;
  }
  /**
   * Reference to the command options
   */
  get options() {
    return this.constructor.options;
  }
  /**
   * Reference to the command args
   */
  get args() {
    return this.constructor.args;
  }
  /**
   * Reference to the command flags
   */
  get flags() {
    return this.constructor.flags;
  }
  /**
   * Hydrate command by setting class properties from
   * the parsed output
   */
  hydrate() {
    if (this.hydrated) {
      return;
    }
    const CommandConstructor = this.constructor;
    CommandConstructor.args.forEach((arg, index) => {
      Object.defineProperty(this, arg.name, {
        value: this.parsed.args[index],
        enumerable: true,
        writable: true,
        configurable: true
      });
    });
    CommandConstructor.flags.forEach((flag) => {
      Object.defineProperty(this, flag.name, {
        value: this.parsed.flags[flag.flagName],
        enumerable: true,
        writable: true,
        configurable: true
      });
    });
    this.hydrated = true;
  }
  /**
   * The run method should include the implementation for the
   * command.
   */
  async run(..._) {
  }
  /**
   * Executes the commands by running the command's run method.
   */
  async exec() {
    this.hydrate();
    try {
      this.result = await this.run();
      this.exitCode = this.exitCode ?? 0;
      return this.result;
    } catch (error) {
      this.error = error;
      this.exitCode = this.exitCode ?? 1;
      throw error;
    }
  }
  /**
   * JSON representation of the command
   */
  toJSON() {
    return {
      commandName: this.constructor.commandName,
      options: this.constructor.options,
      args: this.parsed.args,
      flags: this.parsed.flags,
      error: this.error,
      result: this.result,
      exitCode: this.exitCode
    };
  }
  /**
   * Assert the command exists with a given exit code
   */
  assertExitCode(code) {
    if (this.exitCode !== code) {
      throw new AssertionError({
        message: `Expected '${this.commandName}' command to finish with exit code '${code}'`,
        actual: this.exitCode,
        expected: code,
        operator: "strictEqual",
        stackStartFn: this.assertExitCode
      });
    }
  }
  /**
   * Assert the command exists with a given exit code
   */
  assertNotExitCode(code) {
    if (this.exitCode === code) {
      throw new AssertionError({
        message: `Expected '${this.commandName}' command to finish without exit code '${this.exitCode}'`,
        stackStartFn: this.assertNotExitCode
      });
    }
  }
  /**
   * Assert the command exists with zero exit code
   */
  assertSucceeded() {
    return this.assertExitCode(0);
  }
  /**
   * Assert the command exists with non-zero exit code
   */
  assertFailed() {
    return this.assertNotExitCode(0);
  }
  /**
   * Assert command to log the expected message
   */
  assertLog(message, stream) {
    const logs = this.logger.getLogs();
    const logMessages = logs.map((log) => log.message);
    const matchingLog = logs.find((log) => log.message === message);
    if (!matchingLog) {
      throw new AssertionError({
        message: `Expected log messages to include ${inspect(message)}`,
        actual: logMessages,
        expected: [message],
        operator: "strictEqual",
        stackStartFn: this.assertLog
      });
    }
    if (stream && matchingLog.stream !== stream) {
      throw new AssertionError({
        message: `Expected log message stream to be ${inspect(stream)}, instead received ${inspect(
          matchingLog.stream
        )}`,
        actual: matchingLog.stream,
        expected: stream,
        operator: "strictEqual",
        stackStartFn: this.assertLog
      });
    }
  }
  /**
   * Assert command to log the expected message
   */
  assertLogMatches(matchingRegex, stream) {
    const logs = this.logger.getLogs();
    const matchingLog = logs.find((log) => matchingRegex.test(log.message));
    if (!matchingLog) {
      throw new AssertionError({
        message: `Expected log messages to match ${inspect(matchingRegex)}`,
        stackStartFn: this.assertLogMatches
      });
    }
    if (stream && matchingLog.stream !== stream) {
      throw new AssertionError({
        message: `Expected log message stream to be ${inspect(stream)}, instead received ${inspect(
          matchingLog.stream
        )}`,
        actual: matchingLog.stream,
        expected: stream,
        operator: "strictEqual",
        stackStartFn: this.assertLogMatches
      });
    }
  }
  /**
   * Assert the command prints a table to stdout
   */
  assertTableRows(rows) {
    const logs = this.logger.getLogs();
    const hasAllMatchingRows = rows.every((row) => {
      const columnsContent = row.join("|");
      return !!logs.find((log) => log.message === columnsContent);
    });
    if (!hasAllMatchingRows) {
      throw new AssertionError({
        message: `Expected log messages to include a table with the expected rows`,
        operator: "strictEqual",
        stackStartFn: this.assertTableRows
      });
    }
  }
};

// src/decorators/args.ts
var args = {
  /**
   * Define argument that accepts a string value
   */
  string(options) {
    return function addArg(target, propertyName) {
      const Command = target.constructor;
      Command.defineArgument(propertyName, { ...options, type: "string" });
    };
  },
  /**
   * Define argument that accepts a spread value
   */
  spread(options) {
    return function addArg(target, propertyName) {
      const Command = target.constructor;
      Command.defineArgument(propertyName, { ...options, type: "spread" });
    };
  }
};

// src/decorators/flags.ts
var flags = {
  /**
   * Define option that accepts a string value
   */
  string(options) {
    return function addArg(target, propertyName) {
      const Command = target.constructor;
      Command.defineFlag(propertyName, { type: "string", ...options });
    };
  },
  /**
   * Define option that accepts a boolean value
   */
  boolean(options) {
    return function addArg(target, propertyName) {
      const Command = target.constructor;
      Command.defineFlag(propertyName, { type: "boolean", ...options });
    };
  },
  /**
   * Define option that accepts a number value
   */
  number(options) {
    return function addArg(target, propertyName) {
      const Command = target.constructor;
      Command.defineFlag(propertyName, { type: "number", ...options });
    };
  },
  /**
   * Define option that accepts an array of values
   */
  array(options) {
    return function addArg(target, propertyName) {
      const Command = target.constructor;
      Command.defineFlag(propertyName, { type: "array", ...options });
    };
  }
};

// src/formatters/flag.ts
var FlagFormatter = class {
  #flag;
  #colors;
  constructor(flag, colors) {
    this.#flag = flag;
    this.#colors = colors;
  }
  /**
   * Formats the value flag
   */
  #formatValueFlag(flag, valuePlaceholder) {
    return flag.required ? `=${valuePlaceholder}` : `[=${valuePlaceholder}]`;
  }
  /**
   * Formats the aliases for the flag
   */
  #formatAliases(flag) {
    if (!flag.alias) {
      return [];
    }
    if (typeof flag.alias === "string") {
      return [`-${flag.alias}`];
    }
    return flag.alias.map((alias) => `-${alias}`);
  }
  /**
   * Formats the array flag by appending ellipsis `...` and wrapping
   * the value to indicate if it is required or not
   */
  #formatArrayFlag(flag) {
    const value = this.#formatValueFlag(flag, `${flag.flagName.toUpperCase()}...`);
    const aliases = this.#formatAliases(flag);
    const flagWithValue = `--${flag.flagName}${value}`;
    if (aliases.length) {
      return `  ${this.#colors.green(`${aliases.join(",")}, ${flagWithValue}`)}  `;
    }
    return `  ${this.#colors.green(flagWithValue)}  `;
  }
  /**
   * Formats the string flag by wrapping the value to indicate
   * if it is required or not
   */
  #formatStringFlag(flag) {
    const value = this.#formatValueFlag(flag, `${flag.flagName.toUpperCase()}`);
    const aliases = this.#formatAliases(flag);
    const flagWithValue = `--${flag.flagName}${value}`;
    if (aliases.length) {
      return `  ${this.#colors.green(`${aliases.join(",")}, ${flagWithValue}`)}  `;
    }
    return `  ${this.#colors.green(flagWithValue)}  `;
  }
  /**
   * Formats the numeric flag by wrapping the value to indicate
   * if it is required or not
   */
  #formatNumericFlag(flag) {
    const value = this.#formatValueFlag(flag, `${flag.flagName.toUpperCase()}`);
    const aliases = this.#formatAliases(flag);
    const flagWithValue = `--${flag.flagName}${value}`;
    if (aliases.length) {
      return `  ${this.#colors.green(`${aliases.join(",")}, ${flagWithValue}`)}  `;
    }
    return `  ${this.#colors.green(flagWithValue)}  `;
  }
  /**
   * Formats the boolean flag. Boolean flags needs no wrapping
   */
  #formatBooleanFlag(flag) {
    const aliases = this.#formatAliases(flag);
    const negatedVariant = flag.showNegatedVariantInHelp ? `|--no-${flag.flagName}` : "";
    const flagWithVariant = `--${flag.flagName}${negatedVariant}`;
    if (aliases.length) {
      return `  ${this.#colors.green(`${aliases.join(",")}, ${flagWithVariant}`)}  `;
    }
    return `  ${this.#colors.green(flagWithVariant)}  `;
  }
  /**
   * Returns formatted description for the flag
   */
  formatDescription() {
    const defaultValue = this.#flag.default !== void 0 ? `[default: ${this.#flag.default}]` : "";
    const separator = defaultValue && this.#flag.description ? " " : "";
    return this.#colors.dim(`${this.#flag.description || ""}${separator}${defaultValue}`);
  }
  /**
   * Returns a formatted version of the flag name and aliases
   */
  formatOption() {
    switch (this.#flag.type) {
      case "array":
        return this.#formatArrayFlag(this.#flag);
      case "string":
        return this.#formatStringFlag(this.#flag);
      case "number":
        return this.#formatNumericFlag(this.#flag);
      case "boolean":
        return this.#formatBooleanFlag(this.#flag);
    }
  }
};

// src/formatters/list.ts
import stringWidth from "string-width";
import { justify, TERMINAL_SIZE, wrap } from "@poppinss/cliui/helpers";
var ListFormatter = class {
  #tables;
  #largestOptionColumnWidth;
  constructor(tables) {
    this.#tables = tables;
    this.#largestOptionColumnWidth = Math.max(
      ...this.#tables.map((table) => table.columns.map((column) => stringWidth(column.option))).flat()
    );
  }
  /**
   * Formats the table to an array of plain text rows.
   */
  #formatTable(table, terminalWidth) {
    const options = justify(
      table.columns.map(({ option }) => option),
      { maxWidth: this.#largestOptionColumnWidth }
    );
    const descriptions = wrap(
      table.columns.map(({ description }) => description),
      {
        startColumn: this.#largestOptionColumnWidth,
        endColumn: terminalWidth,
        trimStart: true
      }
    );
    return table.columns.map((_, index) => `${options[index]}${descriptions[index]}`);
  }
  /**
   * Format tables list into an array of rows
   */
  format(terminalWidth = TERMINAL_SIZE) {
    return this.#tables.map((table) => {
      return {
        heading: table.heading,
        rows: this.#formatTable(table, terminalWidth)
      };
    });
  }
};

// src/helpers.ts
import { Validator } from "jsonschema";
import { RuntimeException } from "@poppinss/utils";

// schemas/main.ts
var schema = {
  $ref: "#/definitions/CommandMetaData",
  $schema: "http://json-schema.org/draft-07/schema#",
  definitions: {
    CommandMetaData: {
      description: "Command metdata required to display command help.",
      properties: {
        aliases: {
          description: "Command aliases. The same command can be run using these aliases as well.",
          items: {
            type: "string"
          },
          type: "array"
        },
        args: {
          description: "Args accepted by the command",
          items: {
            additionalProperties: false,
            properties: {
              allowEmptyValue: {
                description: "Whether or not to allow empty values. When set to false, the validation will fail if the argument is provided an empty string\n\nDefaults to false",
                type: "boolean"
              },
              argumentName: {
                type: "string"
              },
              default: {},
              description: {
                type: "string"
              },
              name: {
                type: "string"
              },
              required: {
                type: "boolean"
              },
              type: {
                enum: ["string", "spread"],
                type: "string"
              }
            },
            required: ["name", "argumentName", "type"],
            type: "object"
          },
          type: "array"
        },
        commandName: {
          description: "The name of the command",
          type: "string"
        },
        description: {
          description: "The command description to show on the help screen",
          type: "string"
        },
        flags: {
          description: "Flags accepted by the command",
          items: {
            additionalProperties: false,
            properties: {
              alias: {
                anyOf: [
                  {
                    type: "string"
                  },
                  {
                    items: {
                      type: "string"
                    },
                    type: "array"
                  }
                ]
              },
              allowEmptyValue: {
                description: "Whether or not to allow empty values. When set to false, the validation will fail if the flag is mentioned but no value is provided\n\nDefaults to false",
                type: "boolean"
              },
              default: {},
              description: {
                type: "string"
              },
              flagName: {
                type: "string"
              },
              name: {
                type: "string"
              },
              required: {
                type: "boolean"
              },
              showNegatedVariantInHelp: {
                description: "Whether or not to display the negated variant in the help output.\n\nApplicable for boolean flags only\n\nDefaults to false",
                type: "boolean"
              },
              type: {
                enum: ["string", "boolean", "number", "array"],
                type: "string"
              }
            },
            required: ["name", "flagName", "type"],
            type: "object"
          },
          type: "array"
        },
        help: {
          anyOf: [
            {
              type: "string"
            },
            {
              items: {
                type: "string"
              },
              type: "array"
            }
          ],
          description: "Help text for the command"
        },
        namespace: {
          description: "Command namespace. The namespace is extracted from the command name",
          type: ["string", "null"]
        },
        options: {
          $ref: "#/definitions/CommandOptions",
          description: "Command configuration options"
        }
      },
      required: ["aliases", "args", "commandName", "description", "flags", "namespace", "options"],
      type: "object"
    },
    CommandOptions: {
      description: "Static set of command options",
      properties: {
        allowUnknownFlags: {
          description: "Whether or not to allow for unknown flags. If set to false, the command will not run when unknown flags are provided through the CLI\n\nDefaults to false",
          type: "boolean"
        },
        staysAlive: {
          description: "When flag set to true, the kernel will not trigger the termination process unless the command explicitly calls the terminate method.\n\nDefaults to false",
          type: "boolean"
        }
      },
      type: "object"
    }
  }
};

// src/helpers.ts
function sortAlphabetically(prev, curr) {
  if (curr > prev) {
    return -1;
  }
  if (curr < prev) {
    return 1;
  }
  return 0;
}
function renderErrorWithSuggestions(ui, message, suggestions) {
  const instructions = ui.sticker().fullScreen().drawBorder((borderChar, colors) => colors.red(borderChar));
  instructions.add(ui.colors.red(message));
  if (suggestions.length) {
    instructions.add("");
    instructions.add(`${ui.colors.dim("Did you mean?")} ${suggestions.slice(0, 4).join(", ")}`);
  }
  instructions.getRenderer().logError(instructions.prepare());
}
function validateCommandMetaData(command, exportPath) {
  if (!command || typeof command !== "object") {
    throw new RuntimeException(`Invalid command metadata exported from ${exportPath}`);
  }
  try {
    new Validator().validate(command, schema, { throwError: true });
  } catch (error) {
    throw new RuntimeException(`Invalid command exported from ${exportPath}. ${error.message}`);
  }
}
function validateCommand(command, exportPath) {
  if (typeof command !== "function" || !command.toString().startsWith("class ")) {
    throw new RuntimeException(
      `Invalid command exported from ${exportPath}. Expected command to be a class`
    );
  }
  const commandConstructor = command;
  if (typeof commandConstructor.serialize !== "function") {
    throw new RuntimeException(
      `Invalid command exported from ${exportPath}. Expected command to extend the "BaseCommand"`
    );
  }
  validateCommandMetaData(commandConstructor.serialize(), exportPath);
}

// src/formatters/command.ts
import string2 from "@poppinss/utils/string";
import { TERMINAL_SIZE as TERMINAL_SIZE2, wrap as wrap2 } from "@poppinss/cliui/helpers";

// src/formatters/argument.ts
var ArgumentFormatter = class {
  #argument;
  #colors;
  constructor(argument, colors) {
    this.#argument = argument;
    this.#colors = colors;
  }
  /**
   * Wraps the optional placeholder on option arguments
   */
  #formatArgument(argument, valuePlaceholder) {
    return argument.required ? `${valuePlaceholder}` : `[${valuePlaceholder}]`;
  }
  /**
   * Returns formatted description for the argument
   */
  formatDescription() {
    const defaultValue = this.#argument.default ? `[default: ${this.#argument.default}]` : "";
    const separator = defaultValue && this.#argument.description ? " " : "";
    return this.#colors.dim(`${this.#argument.description || ""}${separator}${defaultValue}`);
  }
  /**
   * Returns a formatted version of the argument name to be displayed
   * inside a list
   */
  formatListOption() {
    switch (this.#argument.type) {
      case "spread":
        return `  ${this.#colors.green(
          this.#formatArgument(this.#argument, `${this.#argument.argumentName}...`)
        )}  `;
      case "string":
        return `  ${this.#colors.green(
          this.#formatArgument(this.#argument, `${this.#argument.argumentName}`)
        )}  `;
    }
  }
  /**
   * Returns a formatted version of the argument name to
   * be displayed next to usage
   */
  formatOption() {
    switch (this.#argument.type) {
      case "spread":
        return this.#colors.dim(
          `${this.#formatArgument(this.#argument, `<${this.#argument.argumentName}...>`)}`
        );
      case "string":
        return this.#colors.dim(
          `${this.#formatArgument(this.#argument, `<${this.#argument.argumentName}>`)}`
        );
    }
  }
};

// src/formatters/command.ts
var CommandFormatter = class {
  #command;
  #colors;
  constructor(command, colors) {
    this.#command = command;
    this.#colors = colors;
  }
  /**
   * Returns the formatted command name to be displayed in the list
   * of commands
   */
  formatListName(aliases) {
    const formattedAliases = aliases.length ? ` ${this.#colors.dim(`(${aliases.join(", ")})`)}` : "";
    return `  ${this.#colors.green(this.#command.commandName)}${formattedAliases}  `;
  }
  /**
   * Returns the formatted description of the command
   */
  formatDescription() {
    return this.#command.description || "";
  }
  /**
   * Returns multiline command help
   */
  formatHelp(binaryName, terminalWidth = TERMINAL_SIZE2) {
    const binary = binaryName ? `${binaryName}` : "";
    if (!this.#command.help) {
      return "";
    }
    const help = Array.isArray(this.#command.help) ? this.#command.help : [this.#command.help];
    return wrap2(
      help.map((line) => string2.interpolate(line, { binaryName: binary })),
      {
        startColumn: 2,
        trimStart: false,
        endColumn: terminalWidth
      }
    ).join("\n");
  }
  /**
   * Returns the formatted description to be displayed in the list
   * of commands
   */
  formatListDescription() {
    if (!this.#command.description) {
      return "";
    }
    return this.#colors.dim(this.#command.description);
  }
  /**
   * Returns an array of strings, each line contains an individual usage
   */
  formatUsage(aliases, binaryName) {
    const binary = binaryName ? `${binaryName} ` : "";
    const flags2 = this.#command.flags.length ? this.#colors.dim("[options]") : "";
    const args2 = this.#command.args.map((arg) => new ArgumentFormatter(arg, this.#colors).formatOption()).join(" ");
    const separator = flags2 && args2 ? ` ${this.#colors.dim("[--]")} ` : "";
    const mainUsage = [`  ${binary}${this.#command.commandName} ${flags2}${separator}${args2}`];
    return mainUsage.concat(
      aliases.map((alias) => `  ${binary}${alias} ${flags2}${separator}${args2}`)
    );
  }
};

// src/commands/list.ts
var ListCommand = class extends BaseCommand {
  /**
   * Command metadata
   */
  static commandName = "list";
  static description = "View list of available commands";
  static help = [
    "The list command displays a list of all the commands:",
    "  {{ binaryName }} list",
    "",
    "You can also display the commands for a specific namespace:",
    "  {{ binaryName }} list <namespace...>"
  ];
  /**
   * Returns a table for an array of commands.
   */
  #makeCommandsTable(heading, commands) {
    return {
      heading: this.colors.yellow(heading),
      columns: commands.map((command) => {
        const aliases = this.kernel.getCommandAliases(command.commandName);
        const commandFormatter = new CommandFormatter(command, this.colors);
        return {
          option: commandFormatter.formatListName(aliases),
          description: commandFormatter.formatListDescription()
        };
      })
    };
  }
  /**
   * Returns a table for an array of global options
   */
  #makeOptionsTable(heading, flagsList) {
    return {
      heading: this.colors.yellow(heading),
      columns: flagsList.map((flag) => {
        const flagFormatter = new FlagFormatter(flag, this.colors);
        return {
          option: flagFormatter.formatOption(),
          description: flagFormatter.formatDescription()
        };
      })
    };
  }
  /**
   * Returns an array of tables for all the commands or for mentioned
   * namespaces only
   */
  #getCommandsTables(namespaces) {
    if (namespaces && namespaces.length) {
      return namespaces.map((namespace) => {
        return this.#makeCommandsTable(namespace, this.kernel.getNamespaceCommands(namespace));
      });
    }
    return [
      this.#makeCommandsTable("Available commands:", this.kernel.getNamespaceCommands()),
      ...this.kernel.getNamespaces().map(
        (namespace) => this.#makeCommandsTable(namespace, this.kernel.getNamespaceCommands(namespace))
      )
    ];
  }
  /**
   * Returns table for the global flags
   */
  #getOptionsTable() {
    if (!this.kernel.flags.length) {
      return [];
    }
    return [this.#makeOptionsTable("Options:", this.kernel.flags)];
  }
  /**
   * Validates the namespaces mentioned via the "namespaces"
   * flag
   */
  #validateNamespace() {
    if (!this.namespaces) {
      return true;
    }
    const namespaces = this.kernel.getNamespaces();
    const unknownNamespace = this.namespaces.find((namespace) => !namespaces.includes(namespace));
    if (unknownNamespace) {
      renderErrorWithSuggestions(
        this.ui,
        `Namespace "${unknownNamespace}" is not defined`,
        this.kernel.getNamespaceSuggestions(unknownNamespace)
      );
      return false;
    }
    return true;
  }
  /**
   * The method is used to render a list of options and commands
   */
  renderList() {
    const tables = this.#getOptionsTable().concat(this.#getCommandsTables(this.namespaces));
    new ListFormatter(tables).format().forEach((table) => {
      this.logger.log("");
      this.logger.log(table.heading);
      this.logger.log(table.rows.join("\n"));
    });
  }
  renderToJSON() {
    if (this.namespaces && this.namespaces.length) {
      return this.namespaces.map((namespace) => {
        return this.kernel.getNamespaceCommands(namespace);
      }).flat(1);
    }
    return this.kernel.getNamespaceCommands().concat(
      this.kernel.getNamespaces().map((namespace) => this.kernel.getNamespaceCommands(namespace)).flat(1)
    );
  }
  /**
   * Executed by ace directly
   */
  async run() {
    const hasValidNamespaces = this.#validateNamespace();
    if (!hasValidNamespaces) {
      this.exitCode = 1;
      return;
    }
    if (this.json) {
      this.logger.log(JSON.stringify(this.renderToJSON(), null, 2));
      return;
    }
    this.renderList();
  }
};
__decorateClass([
  args.spread({
    description: "Filter list by namespace",
    required: false
  })
], ListCommand.prototype, "namespaces", 2);
__decorateClass([
  flags.boolean({ description: "Get list of commands as JSON" })
], ListCommand.prototype, "json", 2);

// src/loaders/list_loader.ts
var ListLoader = class {
  #commands;
  constructor(commands) {
    this.#commands = commands;
  }
  /**
   * Returns an array of command's metadata
   */
  async getMetaData() {
    return this.#commands.map((command) => command.serialize());
  }
  /**
   * Returns the command class constructor for a given command. Null
   * is returned when unable to lookup the command
   */
  async getCommand(metaData) {
    return this.#commands.find((command) => command.commandName === metaData.commandName) || null;
  }
};

// src/exception_handler.ts
import { errors as promptsErrors } from "@poppinss/prompts";
var ExceptionHandler = class {
  debug = true;
  /**
   * Known error codes. For these error, only the error message is
   * reported using the logger
   */
  knownErrorCodes = [];
  /**
   * Internal set of known error codes.
   */
  internalKnownErrorCode = Object.keys(errors_exports);
  /**
   * Logs error to stderr using logger
   */
  logError(error, kernel) {
    kernel.ui.logger.logError(`${kernel.ui.colors.bgRed().white("  ERROR  ")} ${error.message}`);
  }
  /**
   * Pretty prints uncaught error in debug mode
   */
  async prettyPrintError(error) {
    const { default: youchTerminal } = await import("youch-terminal");
    const { default: Youch } = await import("youch");
    const youch = new Youch(error, {});
    console.log(youchTerminal(await youch.toJSON(), { displayShortPath: true }));
  }
  /**
   * Renders an exception for the console
   */
  async render(error, kernel) {
    if (typeof error !== "object" || error === null || !("message" in error)) {
      this.logError({ message: String(error) }, kernel);
      return;
    }
    if (error instanceof errors_exports.E_COMMAND_NOT_FOUND) {
      renderErrorWithSuggestions(
        kernel.ui,
        error.message,
        kernel.getCommandSuggestions(error.commandName)
      );
      return;
    }
    if (error instanceof promptsErrors.E_PROMPT_CANCELLED) {
      this.logError({ message: "Prompt cancelled" }, kernel);
      return;
    }
    if ("code" in error && typeof error.code === "string" && (this.internalKnownErrorCode.includes(error.code) || this.knownErrorCodes.includes(error.code))) {
      this.logError({ message: error.message }, kernel);
      return;
    }
    if ("render" in error && typeof error.render === "function") {
      return error.render(error, kernel);
    }
    if (!this.debug) {
      this.logError({ message: error.message }, kernel);
      return;
    }
    return this.prettyPrintError(error);
  }
};

// src/kernel.ts
var Kernel2 = class _Kernel {
  errorHandler = new ExceptionHandler();
  /**
   * The default executor for creating command's instance
   * and running them
   */
  static commandExecutor = {
    create(command, parsedArgs, kernel) {
      return new command(kernel, parsedArgs, kernel.ui, kernel.prompt);
    },
    run(command) {
      return command.exec();
    }
  };
  /**
   * The default command to use when creating kernel instance
   * via "static create" method.
   */
  static defaultCommand = ListCommand;
  /**
   * Creates an instance of kernel with the default executor
   * and default command
   */
  static create() {
    return new _Kernel(this.defaultCommand, this.commandExecutor);
  }
  /**
   * Listeners for CLI options. Executed for the main command
   * only
   */
  #optionListeners = /* @__PURE__ */ new Map();
  /**
   * The global command is used to register global flags applicable
   * on all the commands
   */
  #globalCommand = class extends BaseCommand {
    static options = {
      allowUnknownFlags: true
    };
  };
  /**
   * The default command to run when no command is mentioned. The default
   * command will also run when only flags are mentioned.
   */
  #defaultCommand;
  /**
   * Available hooks
   */
  #hooks = new Hooks();
  /**
   * Executors are used to instantiate a command and execute
   * the run method.
   */
  #executor;
  /**
   * Keeping track of the main command. There are some action (like termination)
   * that only the main command can perform
   */
  #mainCommand;
  /**
   * The current state of kernel. The `running` and `terminated`
   * states are only set when kernel takes over the process.
   */
  #state = "idle";
  /**
   * Collection of loaders to use for loading commands
   */
  #loaders = [];
  /**
   * An array of registered namespaces. Sorted alphabetically
   */
  #namespaces = [];
  /**
   * A collection of aliases for the commands. The key is the alias name
   * and the value is the command name.
   *
   * In case of duplicate aliases, the most recent alias will override
   * the previous existing alias.
   */
  #aliases = /* @__PURE__ */ new Map();
  /**
   * An collection of expansion arguments and flags set on
   * an alias. The key is the alias name and the value is
   * everything after it.
   */
  #aliasExpansions = /* @__PURE__ */ new Map();
  /**
   * A collection of commands by the command name. This allows us to keep only
   * the unique commands and also keep the loader reference to know which
   * loader to ask for loading the command.
   */
  #commands = /* @__PURE__ */ new Map();
  /**
   * The exit code for the kernel. The exit code is inferred
   * from the main code when not set explicitly.
   */
  exitCode;
  /**
   * The UI primitives to use within commands
   */
  ui = cliui();
  /**
   * Instance of prompt to display CLI prompts. We share
   * a single instance with all the commands. This
   * allows trapping prompts for commands executed
   * internally.
   */
  prompt = new Prompt();
  /**
   * CLI info map
   */
  info = /* @__PURE__ */ new Map();
  /**
   * List of global flags
   */
  get flags() {
    return this.#globalCommand.flags;
  }
  constructor(defaultCommand, executor) {
    this.#defaultCommand = defaultCommand;
    this.#executor = executor;
  }
  /**
   * Process command line arguments. All flags before the command
   * name are considered as Node.js argv and all flags after
   * the command name are considered as command argv.
   *
   * The behavior is same as Node.js CLI, where all flags before the
   * script file name are Node.js argv.
   */
  #processArgv(argv) {
    const commandNameIndex = argv.findIndex((value) => !value.startsWith("-"));
    if (commandNameIndex === -1) {
      return {
        nodeArgv: [],
        commandName: null,
        commandArgv: argv
      };
    }
    return {
      nodeArgv: argv.slice(0, commandNameIndex),
      commandName: argv[commandNameIndex],
      commandArgv: argv.slice(commandNameIndex + 1)
    };
  }
  /**
   * Creates an instance of a command by parsing and validating
   * the command line arguments.
   */
  async #create(Command, argv) {
    const parsed = new Parser(Command.getParserOptions()).parse(argv);
    Command.validate(parsed);
    const commandInstance = await this.#executor.create(Command, parsed, this);
    commandInstance.hydrate();
    return commandInstance;
  }
  /**
   * Executes a given command. The main commands are executed using the
   * "execMain" method.
   */
  async #exec(commandName, argv) {
    const Command = await this.find(commandName);
    const aliasExpansions = this.#aliasExpansions.get(commandName);
    if (aliasExpansions) {
      argv = aliasExpansions.concat(argv);
      debug_default("expanding alias %O, cli args %O", commandName, argv);
    }
    const commandInstance = await this.#create(Command, argv);
    await this.#hooks.runner("executing").run(commandInstance, false);
    await this.#executor.run(commandInstance, this);
    await this.#hooks.runner("executed").run(commandInstance, false);
    return commandInstance;
  }
  /**
   * Executes the main command and handles the exceptions by
   * reporting them
   */
  async #execMain(commandName, nodeArgv, argv) {
    try {
      const Command = await this.find(commandName);
      const aliasExpansions = this.#aliasExpansions.get(commandName);
      if (aliasExpansions) {
        argv = aliasExpansions.concat(argv);
        debug_default("expanding alias %O, cli args %O", commandName, argv);
      }
      const parsed = new Parser(
        Command.getParserOptions(this.#globalCommand.getParserOptions().flagsParserOptions)
      ).parse(argv);
      parsed.nodeArgs = nodeArgv;
      this.#globalCommand.validate(parsed);
      let shortcircuit = false;
      for (let [option, listener] of this.#optionListeners) {
        if (parsed.flags[option] !== void 0) {
          debug_default('running listener for "%s" flag', option);
          shortcircuit = await listener(Command, this, parsed);
          if (shortcircuit) {
            break;
          }
        }
      }
      Command.validate(parsed);
      if (shortcircuit) {
        debug_default("short circuiting from flag listener");
        this.exitCode = this.exitCode ?? 0;
        this.#state = "completed";
        return;
      }
      this.#mainCommand = await this.#executor.create(Command, parsed, this);
      this.#mainCommand.hydrate();
      await this.#hooks.runner("executing").run(this.#mainCommand, true);
      await this.#executor.run(this.#mainCommand, this);
      await this.#hooks.runner("executed").run(this.#mainCommand, true);
      this.exitCode = this.exitCode ?? this.#mainCommand.exitCode;
      this.#state = "completed";
    } catch (error) {
      this.exitCode = 1;
      this.#state = "completed";
      await this.errorHandler.render(error, this);
    }
  }
  /**
   * Listen for CLI options and execute an action. Only one listener
   * can be defined per option.
   *
   * The callbacks are only executed for the main command
   */
  on(option, callback) {
    debug_default('registering flag listener for "%s" flag', option);
    this.#optionListeners.set(option, callback);
    return this;
  }
  /**
   * Define a global flag that is applicable for all the
   * commands.
   */
  defineFlag(name, options) {
    if (this.#state !== "idle") {
      throw new RuntimeException2(`Cannot register global flag in "${this.#state}" state`);
    }
    this.#globalCommand.defineFlag(name, options);
  }
  /**
   * Register a commands loader. The commands will be collected by
   * all the loaders.
   *
   * Incase multiple loaders returns a single command, the command from the
   * most recent loader will be used.
   */
  addLoader(loader) {
    if (this.#state !== "idle") {
      throw new RuntimeException2(`Cannot add loader in "${this.#state}" state`);
    }
    this.#loaders.push(loader);
    return this;
  }
  /**
   * Register alias for a comamnd name.
   */
  addAlias(alias, command) {
    const [commandName, ...expansions] = command.split(" ");
    this.#aliases.set(alias, commandName);
    if (expansions.length) {
      debug_default("registering alias %O for command %O with options %O", alias, commandName, expansions);
      this.#aliasExpansions.set(alias, expansions);
    } else {
      debug_default("registering alias %O for command %O", alias, commandName);
    }
    return this;
  }
  /**
   * Check if a command or an alias is registered with kernel
   */
  hasCommand(commandName) {
    commandName = this.#aliases.get(commandName) || commandName;
    return this.#commands.has(commandName);
  }
  /**
   * Get the current state of the kernel.
   */
  getState() {
    return this.#state;
  }
  /**
   * Returns a flat list of commands metadata registered with the kernel.
   * The list is sorted alphabetically by the command name.
   */
  getCommands() {
    return [...this.#commands.keys()].sort(sortAlphabetically).map((name) => this.#commands.get(name).metaData);
  }
  /**
   * Get a list of commands for a specific namespace. All non-namespaces
   * commands will be returned if no namespace is defined.
   */
  getNamespaceCommands(namespace) {
    let commandNames = [...this.#commands.keys()];
    if (namespace) {
      commandNames = commandNames.filter(
        (name) => this.#commands.get(name).metaData.namespace === namespace
      );
    } else {
      commandNames = commandNames.filter((name) => !this.#commands.get(name).metaData.namespace);
    }
    return commandNames.sort(sortAlphabetically).map((name) => this.#commands.get(name).metaData);
  }
  /**
   * Returns the command metadata by its name. Returns null when the
   * command is missing.
   */
  getCommand(commandName) {
    return this.#commands.get(commandName)?.metaData || null;
  }
  /**
   * Returns a reference for the default command. The return value
   * is the default command constructor
   */
  getDefaultCommand() {
    return this.#defaultCommand;
  }
  /**
   * Returns reference to the main command
   */
  getMainCommand() {
    return this.#mainCommand;
  }
  /**
   * Returns an array of aliases registered.
   *
   * - Call `getCommandAliases` method to get aliases for a given command
   * - Call `getAliasCommand` to get the command or a given alias
   */
  getAliases() {
    return [...this.#aliases.keys()];
  }
  /**
   * Returns the command metata for a given alias. Returns null
   * if alias is not recognized.
   */
  getAliasCommand(alias) {
    const aliasCommand = this.#aliases.get(alias);
    if (!aliasCommand) {
      return null;
    }
    return this.#commands.get(aliasCommand)?.metaData || null;
  }
  /**
   * Returns an array of aliases for a given command
   */
  getCommandAliases(commandName) {
    return [...this.#aliases.entries()].filter(([, command]) => {
      return command === commandName;
    }).map(([alias]) => alias);
  }
  /**
   * Returns a list of namespaces. The list is sorted alphabetically
   * by the namespace name
   */
  getNamespaces() {
    return this.#namespaces;
  }
  /**
   * Returns an array of command and aliases name suggestions for
   * a given keyword.
   */
  getCommandSuggestions(keyword) {
    if (this.#namespaces.includes(keyword)) {
      return this.getNamespaceCommands(keyword).map((command) => command.commandName);
    }
    const commandsAndAliases = [...this.#commands.keys()].concat([...this.#aliases.keys()]);
    return commandsAndAliases.map((value) => {
      return {
        value,
        distance: distance(keyword, value)
      };
    }).sort((current, next) => next.distance - current.distance).filter((rating) => {
      return rating.distance <= 3;
    }).map((rating) => rating.value);
  }
  /**
   * Returns an array of namespaces suggestions for a given keyword.
   */
  getNamespaceSuggestions(keyword) {
    return this.#namespaces.map((value) => {
      return {
        value,
        distance: distance(keyword, value)
      };
    }).sort((current, next) => next.distance - current.distance).filter((rating) => {
      return rating.distance <= 3;
    }).map((rating) => rating.value);
  }
  /**
   * Listen for the event before we begin the process of finding
   * the command.
   */
  finding(callback) {
    this.#hooks.add("finding", callback);
    return this;
  }
  /**
   * Listen for the event when importing the command
   */
  loading(callback) {
    this.#hooks.add("loading", callback);
    return this;
  }
  /**
   * Listen for the event when the command has been imported
   */
  loaded(callback) {
    this.#hooks.add("loaded", callback);
    return this;
  }
  /**
   * Listen for the event before we start to execute the command.
   */
  executing(callback) {
    this.#hooks.add("executing", callback);
    return this;
  }
  /**
   * Listen for the event after the command has been executed
   */
  executed(callback) {
    this.#hooks.add("executed", callback);
    return this;
  }
  /**
   * Loads commands from all the registered loaders. The "addLoader" method
   * must be called before calling the "load" method.
   */
  async boot() {
    if (this.#state !== "idle") {
      return;
    }
    this.#globalCommand.boot();
    this.addLoader(new ListLoader([this.#defaultCommand]));
    this.#state = "booted";
    const namespaces = /* @__PURE__ */ new Set();
    for (let loader of this.#loaders) {
      let loaderInstance;
      if (typeof loader === "function") {
        loaderInstance = await loader();
      } else {
        loaderInstance = loader;
      }
      const commands = await loaderInstance.getMetaData();
      commands.forEach((command) => {
        this.#commands.set(command.commandName, { metaData: command, loader: loaderInstance });
        command.aliases.forEach((alias) => this.addAlias(alias, command.commandName));
        command.namespace && namespaces.add(command.namespace);
      });
    }
    this.#namespaces = [...namespaces].sort(sortAlphabetically);
  }
  /**
   * Find a command by its name
   */
  async find(commandName) {
    commandName = this.#aliases.get(commandName) || commandName;
    await this.#hooks.runner("finding").run(commandName);
    const command = this.#commands.get(commandName);
    if (!command) {
      throw new E_COMMAND_NOT_FOUND([commandName]);
    }
    await this.#hooks.runner("loading").run(command.metaData);
    const commandConstructor = await command.loader.getCommand(command.metaData);
    if (!commandConstructor) {
      throw new E_COMMAND_NOT_FOUND([commandName]);
    }
    await this.#hooks.runner("loaded").run(commandConstructor);
    return commandConstructor;
  }
  /**
   * Execute a command. The second argument is an array of commandline
   * arguments (without the command name)
   */
  async exec(commandName, argv) {
    if (this.#state === "idle") {
      await this.boot();
    }
    if (this.#state === "completed") {
      throw new RuntimeException2(
        "The kernel has been terminated. Create a fresh instance to execute commands"
      );
    }
    return this.#exec(commandName, argv);
  }
  /**
   * Creates a command instance by parsing and validating
   * the command-line arguments.
   */
  async create(command, argv) {
    if (this.#state === "idle") {
      await this.boot();
    }
    return this.#create(command, argv);
  }
  /**
   * Handle process argv and execute the command. Calling this method
   * makes kernel own the process and register SIGNAL listeners
   */
  async handle(argv) {
    if (this.#state === "running") {
      throw new RuntimeException2("Cannot run multiple main commands from a single process");
    }
    if (this.#state === "completed") {
      throw new RuntimeException2(
        "The kernel has been terminated. Create a fresh instance to execute commands"
      );
    }
    if (this.#state === "idle") {
      await this.boot();
    }
    this.#state = "running";
    const { commandName, nodeArgv, commandArgv } = this.#processArgv(argv);
    if (!commandName) {
      debug_default('running default command "%s"', this.#defaultCommand.commandName);
      return this.#execMain(this.#defaultCommand.commandName, nodeArgv, commandArgv);
    }
    debug_default('running main command "%s"', commandName);
    return this.#execMain(commandName, nodeArgv, commandArgv);
  }
  /**
   * A named function that returns true. To be used
   * by flag listeners
   */
  shortcircuit() {
    return true;
  }
};

// index.ts
import * as cliHelpers from "@poppinss/cliui/helpers";

// src/commands/help.ts
import { TERMINAL_SIZE as TERMINAL_SIZE3, wrap as wrap3 } from "@poppinss/cliui/helpers";
var HelpCommand = class extends BaseCommand {
  /**
   * Command metadata
   */
  static commandName = "help";
  static description = "View help for a given command";
  /**
   * Returns the command arguments table
   */
  #makeArgumentsTable(heading, command) {
    if (!command.args.length) {
      return [];
    }
    return [
      {
        heading: this.colors.yellow(heading),
        columns: command.args.map((arg) => {
          const formatter = new ArgumentFormatter(arg, this.colors);
          return {
            option: formatter.formatListOption(),
            description: formatter.formatDescription()
          };
        })
      }
    ];
  }
  /**
   * Returns the commands options table
   */
  #makeOptionsTable(heading, command) {
    if (!command.flags.length) {
      return [];
    }
    return [
      {
        heading: this.colors.yellow(heading),
        columns: command.flags.map((flag) => {
          const formatter = new FlagFormatter(flag, this.colors);
          return {
            option: formatter.formatOption(),
            description: formatter.formatDescription()
          };
        })
      }
    ];
  }
  /**
   * Validates the command name to ensure it exists
   */
  #validateCommandName() {
    const command = this.kernel.getCommand(this.name);
    if (!command) {
      renderErrorWithSuggestions(
        this.ui,
        `Command "${this.name}" is not defined`,
        this.kernel.getCommandSuggestions(this.name)
      );
      return false;
    }
    return true;
  }
  /**
   * Logs command description
   */
  renderDescription(command) {
    const formatter = new CommandFormatter(command, this.colors);
    const description = formatter.formatDescription();
    if (!description) {
      return;
    }
    this.logger.log("");
    this.logger.log(this.colors.yellow("Description:"));
    this.logger.log(
      wrap3([description], {
        startColumn: 2,
        trimStart: false,
        endColumn: TERMINAL_SIZE3
      }).join("\n")
    );
  }
  /**
   * Logs command usage
   */
  renderUsage(command) {
    const aliases = this.kernel.getCommandAliases(command.commandName);
    const formatter = new CommandFormatter(command, this.colors);
    const usage = formatter.formatUsage(aliases, this.kernel.info.get("binary")).join("\n");
    this.logger.log("");
    this.logger.log(this.colors.yellow("Usage:"));
    this.logger.log(usage);
  }
  /**
   * Logs commands arguments and options tables
   */
  renderList(command) {
    const tables = this.#makeArgumentsTable("Arguments:", command).concat(
      this.#makeOptionsTable("Options:", command)
    );
    new ListFormatter(tables).format().forEach((table) => {
      this.logger.log("");
      this.logger.log(table.heading);
      this.logger.log(table.rows.join("\n"));
    });
  }
  /**
   * Logs command help text
   */
  renderHelp(command) {
    const formatter = new CommandFormatter(command, this.colors);
    const help = formatter.formatHelp(this.kernel.info.get("binary"));
    if (!help) {
      return;
    }
    this.logger.log("");
    this.logger.log(this.colors.yellow("Help:"));
    this.logger.log(help);
  }
  /**
   * Executed by ace directly
   */
  async run() {
    const isValidCommand = this.#validateCommandName();
    if (!isValidCommand) {
      this.exitCode = 1;
      return;
    }
    const command = this.kernel.getCommand(this.name);
    this.renderDescription(command);
    this.renderUsage(command);
    this.renderList(command);
    this.renderHelp(command);
  }
};
__decorateClass([
  args.string({ description: "Command name", argumentName: "command" })
], HelpCommand.prototype, "name", 2);

// src/loaders/fs_loader.ts
import { fileURLToPath } from "url";
import { basename, extname, relative } from "path";
import { fsReadAll, importDefault, slash } from "@poppinss/utils";
var JS_MODULES = [".js", ".cjs", ".mjs"];
var FsLoader = class {
  /**
   * Absolute path to directory from which to load files
   */
  #comandsDirectory;
  /**
   * File to ignore files
   */
  #filter;
  /**
   * An array of loaded commands
   */
  #commands = [];
  constructor(comandsDirectory, filter) {
    this.#comandsDirectory = comandsDirectory;
    this.#filter = filter;
  }
  /**
   * Returns a collection of commands. The command value
   * is unknown and must be validated
   */
  async #loadCommands() {
    const commands = {};
    const commandFiles = await fsReadAll(this.#comandsDirectory, {
      pathType: "url",
      ignoreMissingRoot: true,
      filter: (filePath) => {
        const ext = extname(filePath);
        if (basename(filePath).startsWith("_")) {
          return false;
        }
        if (JS_MODULES.includes(ext)) {
          return true;
        }
        if (ext === ".ts" && !filePath.endsWith(".d.ts")) {
          return true;
        }
        return false;
      }
    });
    for (let file of commandFiles) {
      if (file.endsWith(".ts")) {
        file = file.replace(/\.ts$/, ".js");
      }
      const relativeFileName = slash(relative(this.#comandsDirectory, fileURLToPath(file)));
      if (!this.#filter || this.#filter(relativeFileName)) {
        commands[relativeFileName] = await importDefault(() => import(file), relativeFileName);
      }
    }
    return commands;
  }
  /**
   * Returns the metadata of commands
   */
  async getMetaData() {
    const commandsCollection = await this.#loadCommands();
    Object.keys(commandsCollection).forEach((key) => {
      const command = commandsCollection[key];
      validateCommand(command, `"${key}" file`);
      this.#commands.push({ command, filePath: key });
    });
    return this.#commands.map(({ command, filePath }) => {
      return Object.assign({}, command.serialize(), { filePath });
    });
  }
  /**
   * Returns the command class constructor for a given command. Null
   * is returned when unable to lookup the command
   */
  async getCommand(metaData) {
    return this.#commands.find(({ command }) => {
      return command.commandName === metaData.commandName;
    })?.command || null;
  }
};

// src/generators/index_generator.ts
import { join } from "path";
import { copyFile, mkdir, writeFile } from "fs/promises";

// stubs/main.ts
import { getDirname } from "@poppinss/utils";
var stubsRoot = getDirname(import.meta.url);

// src/generators/index_generator.ts
var IndexGenerator = class {
  #commandsDir;
  constructor(commandsDir) {
    this.#commandsDir = commandsDir;
  }
  /**
   * Generate index
   */
  async generate() {
    const commandsMetaData = await new FsLoader(this.#commandsDir).getMetaData();
    const indexJSON = JSON.stringify({ commands: commandsMetaData, version: 1 });
    const indexFile = join(this.#commandsDir, "commands.json");
    const loaderFile = join(this.#commandsDir, "main.js");
    const loaderStub = join(stubsRoot, "commands_loader.stub");
    const loaderTypes = join(this.#commandsDir, "main.d.ts");
    const loaderTypesStub = join(stubsRoot, "commands_loader_types.stub");
    await mkdir(this.#commandsDir, { recursive: true });
    console.log(`artifacts directory: ${this.#commandsDir}`);
    await writeFile(indexFile, indexJSON);
    console.log("create commands.json");
    await copyFile(loaderStub, loaderFile);
    console.log("create main.js");
    await copyFile(loaderTypesStub, loaderTypes);
    console.log("create main.d.ts");
  }
};
export {
  BaseCommand,
  ExceptionHandler,
  FsLoader,
  HelpCommand,
  IndexGenerator,
  Kernel2 as Kernel,
  ListCommand,
  ListLoader,
  Parser,
  args,
  cliHelpers,
  errors_exports as errors,
  flags
};
//# sourceMappingURL=index.js.map