import "node:module";
import enq from "enquirer";
import { AssertionError } from "node:assert";
import { ObjectBuilder } from "@poppinss/object-builder";
import useColors from "@poppinss/colors";
import { inspect } from "node:util";
import { createError } from "@poppinss/exception";
var __defProp = Object.defineProperty;
var __export = (all, symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
const colors = useColors.ansi();
var MockedPrompt = class {
	#answer;
	#choiceSelection;
	#multiChoiceSelection;
	#assertions = [];
	#setAnswer(answer) {
		if (this.#answer === void 0) this.#answer = answer;
	}
	#setSelectDefaults(options) {
		const defaultAnswer = options.initial !== void 0 ? options.initial : 0;
		if (typeof defaultAnswer === "number") {
			if (this.#choiceSelection === void 0) this.#choiceSelection = defaultAnswer;
			return;
		}
		if (defaultAnswer !== void 0) this.#setAnswer(defaultAnswer);
	}
	#setMultiSelectDefaults(options) {
		this.#setAnswer(options.initial);
	}
	#setToggleDefaults(options) {
		this.#setAnswer(options.initial !== void 0 ? options.initial : false);
	}
	#setConfirmationDefaults(options) {
		this.#setAnswer(options.initial !== void 0 ? options.initial : false);
	}
	#setTextDefaults(options) {
		this.#setAnswer(options.initial);
	}
	#isToggle(options) {
		return options.type === "toggle";
	}
	#isConfirmation(options) {
		return options.type === "confirm";
	}
	#isSelect(options) {
		return options.type === "select" && options.choices || options.type === "autocomplete" && !options.multiple && options.choices;
	}
	#isMultiSelect(options) {
		return options.type === "multiselect" && options.choices || options.type === "autocomplete" && options.multiple && options.choices;
	}
	#isText(options) {
		return options.type === "input" || options.type === "password" || options.type === "list";
	}
	async #assert(options) {
		const state = {
			message: options.message,
			type: options.type,
			name: options.name,
			value: ""
		};
		if (!options.validate && this.#assertions.length) throw this.#assertions[0].error;
		for (let assertion of this.#assertions) {
			const result = await options.validate(assertion.value, state);
			if (!assertion.expectsError) {
				if (result !== true) throw assertion.error;
			} else {
				if (result === true) throw assertion.error;
				if (typeof assertion.expectedErrorMessage === "string" && result !== assertion.expectedErrorMessage) {
					assertion.error.actual = result;
					throw assertion.error;
				}
				if (assertion.expectedErrorMessage instanceof RegExp && !assertion.expectedErrorMessage.test(result)) throw assertion.error;
			}
		}
	}
	#formatInput(input, options) {
		if (options.type === "list") return input.split(options.sep);
		return input;
	}
	async #transformResult(result, options) {
		if (typeof options.result === "function") return options.result(result);
		return result;
	}
	#convertChoiceToAnswer(options) {
		if (this.#answer !== void 0) return;
		const answer = options.choices[this.#choiceSelection];
		this.#setAnswer(typeof answer === "string" ? answer : answer?.name);
	}
	#convertMultipleChoicesToAnswer(options) {
		if (this.#answer !== void 0) {
			if (!Array.isArray(this.#answer)) this.#answer = [this.#answer];
			return;
		}
		if (!this.#multiChoiceSelection) this.#multiChoiceSelection = this.#choiceSelection !== void 0 ? [this.#choiceSelection] : [];
		const answers = this.#multiChoiceSelection.map((index) => {
			const answer = options.choices[index];
			return typeof answer === "string" ? answer : answer?.name;
		});
		this.#setAnswer(answers);
	}
	constructor() {}
	replyWith(answer) {
		this.#answer = answer;
		return this;
	}
	accept() {
		return this.replyWith(true);
	}
	reject() {
		return this.replyWith(false);
	}
	chooseOption(index) {
		this.#choiceSelection = index;
		return this;
	}
	chooseOptions(indexes) {
		this.#multiChoiceSelection = indexes;
		return this;
	}
	assertFails(value, message) {
		if (!message) {
			this.#assertions.push({
				value,
				expectsError: true,
				expectedErrorMessage: message,
				error: new AssertionError({
					message: "Expected prompt validation to fail",
					stackStartFn: this.assertFails
				})
			});
			return this;
		}
		if (typeof message === "string") {
			const error = new AssertionError({
				message: `Expected prompt validation message to equal ${inspect(message)}`,
				expected: message,
				operator: "strictEqual",
				stackStartFn: this.assertFails
			});
			Object.defineProperty(error, "showDiff", { value: true });
			this.#assertions.push({
				value,
				expectsError: true,
				expectedErrorMessage: message,
				error
			});
			return this;
		}
		this.#assertions.push({
			value,
			expectsError: true,
			expectedErrorMessage: message,
			error: new AssertionError({
				message: `Expected prompt validation message to match ${inspect(message)}`,
				expected: message
			})
		});
		return this;
	}
	assertPasses(value) {
		const error = new AssertionError({ message: "Expected assertion to pass, instead it failed" });
		this.#assertions.push({
			value,
			expectsError: false,
			error
		});
		return this;
	}
	async handle(options) {
		if (this.#isSelect(options)) {
			this.#setSelectDefaults(options);
			this.#convertChoiceToAnswer(options);
		} else if (this.#isMultiSelect(options)) {
			this.#setMultiSelectDefaults(options);
			this.#convertMultipleChoicesToAnswer(options);
		} else if (this.#isToggle(options)) this.#setToggleDefaults(options);
		else if (this.#isConfirmation(options)) this.#setConfirmationDefaults(options);
		else if (this.#isText(options)) this.#setTextDefaults(options);
		this.#answer = this.#formatInput(this.#answer, options);
		await this.#assert(options);
		return this.#transformResult(this.#answer, options);
	}
};
const icons = process.platform === "win32" && !process.env.WT_SESSION ? { pointer: ">" } : { pointer: "❯" };
const promptStyles = {
	danger: (value) => colors.red(value),
	submitted: (value) => colors.cyan(value)
};
const promptPrefix = colors.dim(icons.pointer);
const promptHiglight = (value) => colors.yellow(value);
var BasePrompt = class {
	traps = {
		prompts: /* @__PURE__ */ new Map(),
		verify() {
			this.prompts.forEach((entry) => {
				throw entry.triggerError;
			});
		}
	};
	#handlePrompt(options) {
		let mockedPrompt;
		if (this.traps.prompts.has(options.name)) {
			mockedPrompt = this.traps.prompts.get(options.name).prompt;
			this.traps.prompts.delete(options.name);
		} else if (this.traps.prompts.has(options.message)) {
			mockedPrompt = this.traps.prompts.get(options.message).prompt;
			this.traps.prompts.delete(options.message);
		}
		if (mockedPrompt) return mockedPrompt.handle(options);
		return this.prompt(options);
	}
	async ask(title, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "input");
		builder.add("name", options.name || "prompt");
		builder.add("message", title);
		builder.add("hint", options.hint);
		builder.add("initial", options.default);
		builder.add("result", options.result);
		builder.add("format", options.format);
		builder.add("validate", options.validate);
		builder.add("prefix", promptPrefix);
		builder.add("styles", promptStyles);
		return this.#handlePrompt(builder.toObject());
	}
	async list(title, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "list");
		builder.add("name", options.name || "prompt");
		builder.add("sep", options.seperator || ",");
		builder.add("name", options.name);
		builder.add("message", title);
		builder.add("hint", options.hint);
		builder.add("initial", options.default);
		builder.add("result", options.result);
		builder.add("format", options.format);
		builder.add("validate", options.validate);
		builder.add("prefix", promptPrefix);
		builder.add("styles", promptStyles);
		return this.#handlePrompt(builder.toObject());
	}
	async secure(title, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "password");
		builder.add("name", options.name || "prompt");
		builder.add("message", title);
		builder.add("initial", options.default);
		builder.add("result", options.result);
		builder.add("format", options.format);
		builder.add("validate", options.validate);
		builder.add("prefix", promptPrefix);
		builder.add("styles", promptStyles);
		return this.#handlePrompt(builder.toObject());
	}
	async confirm(title, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "confirm");
		builder.add("name", options.name || "prompt");
		builder.add("message", title);
		builder.add("hint", options.hint);
		builder.add("initial", options.default);
		builder.add("result", options.result);
		builder.add("format", options.format);
		builder.add("validate", options.validate);
		builder.add("prefix", promptPrefix);
		builder.add("styles", promptStyles);
		return this.#handlePrompt(builder.toObject());
	}
	async toggle(title, choices, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "toggle");
		builder.add("name", options.name || "prompt");
		builder.add("message", title);
		builder.add("hint", options.hint);
		builder.add("initial", options.default);
		builder.add("result", options.result);
		builder.add("format", options.format);
		builder.add("validate", options.validate);
		builder.add("enabled", choices[0]);
		builder.add("disabled", choices[1]);
		builder.add("prefix", promptPrefix);
		builder.add("styles", promptStyles);
		return this.#handlePrompt(builder.toObject());
	}
	async choice(title, choices, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "select");
		builder.add("name", options.name || "prompt");
		builder.add("message", title);
		builder.add("initial", options.default);
		builder.add("hint", options.hint || "Press <ENTER> to select");
		builder.add("result", options.result);
		builder.add("format", options.format);
		builder.add("validate", options.validate);
		builder.add("prefix", promptPrefix);
		builder.add("styles", promptStyles);
		builder.add("choices", choices.map((choice) => {
			if (typeof choice === "string") return {
				name: choice,
				message: choice,
				value: choice
			};
			return choice;
		}));
		return this.#handlePrompt(builder.toObject());
	}
	async multiple(title, choices, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "multiselect");
		builder.add("name", options.name || "prompt");
		builder.add("message", title);
		builder.add("initial", options.default);
		builder.add("result", options.result);
		builder.add("format", options.format);
		builder.add("hint", options.hint || "Press <SPACE> to select");
		builder.add("validate", options.validate);
		builder.add("prefix", promptPrefix);
		builder.add("styles", promptStyles);
		builder.add("indicator", (state, choice) => {
			if (choice.enabled) return colors.cyan(state.symbols.radio.on);
			return colors.dim(state.symbols.radio.off);
		});
		builder.add("choices", choices.map((choice) => {
			if (typeof choice === "string") return {
				name: choice,
				message: choice,
				value: choice
			};
			return choice;
		}));
		return this.#handlePrompt(builder.toObject());
	}
	async autocomplete(title, choices, options) {
		options = options || {};
		const builder = new ObjectBuilder({});
		builder.add("type", "autocomplete");
		builder.add("name", options.name || "prompt");
		builder.add("message", title);
		builder.add("initial", options.default);
		builder.add("multiple", options.multiple);
		builder.add("result", options.result);
		builder.add("hint", options.hint || options.multiple ? "Press <SPACE> to select" : "Press <ENTER> to select");
		builder.add("format", options.format);
		builder.add("limit", options.limit);
		builder.add("validate", options.validate);
		builder.add("footer", options.footer);
		builder.add("choices", choices);
		builder.add("prefix", promptPrefix);
		builder.add("highlight", promptHiglight);
		builder.add("styles", promptStyles);
		return this.#handlePrompt(builder.toObject());
	}
	trap(message) {
		const triggerError = new AssertionError({ message: `Expected prompt "${message}" to get triggered` });
		const mockedPrompt = new MockedPrompt();
		this.traps.prompts.set(message, {
			prompt: mockedPrompt,
			triggerError
		});
		return mockedPrompt;
	}
};
var errors_exports = /* @__PURE__ */ __export({ E_PROMPT_CANCELLED: () => E_PROMPT_CANCELLED });
const E_PROMPT_CANCELLED = createError("Prompt cancelled", "E_PROMPT_CANCELLED", 500);
const enquirer = enq;
var Prompt = class extends BasePrompt {
	async prompt(options) {
		let cancelled = false;
		options = Object.assign({ onCancel() {
			cancelled = true;
		} }, options);
		try {
			return (await enquirer.prompt(options))[options.name];
		} catch (error) {
			if (cancelled) throw new E_PROMPT_CANCELLED();
			throw error;
		}
	}
};
export { Prompt, errors_exports as errors };
