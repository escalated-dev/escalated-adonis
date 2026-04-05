import { t as TERMINAL_SIZE } from "./helpers--eCRbeCy.js";
import supportsColor from "supports-color";
import colors$1, { default as poppinssColors } from "@poppinss/colors";
import CliTable from "cli-table3";
import stringWidth from "string-width";
import logUpdate from "log-update";
import prettyHrtime from "pretty-hrtime";
const { platform } = process;
const icons = platform === "win32" && !process.env.WT_SESSION ? {
	tick: "√",
	cross: "×",
	bullet: "*",
	nodejs: "♦",
	pointer: ">",
	info: "i",
	warning: "‼",
	squareSmallFilled: "[█]",
	borderVertical: "|"
} : {
	tick: "✔",
	cross: "✖",
	bullet: "●",
	nodejs: "⬢",
	pointer: "❯",
	info: "ℹ",
	warning: "⚠",
	squareSmallFilled: "◼",
	borderVertical: "│"
};
function useColors(options = {}) {
	if (options.raw) return colors$1.raw();
	if (options.silent) return colors$1.silent();
	return colors$1.ansi();
}
var ConsoleRenderer = class {
	getLogs() {
		return [];
	}
	flushLogs() {}
	log(message) {
		console.log(message);
	}
	logUpdate(message) {
		logUpdate(message);
	}
	logUpdatePersist() {
		logUpdate.done();
	}
	logError(message) {
		console.error(message);
	}
};
var Table = class {
	#state = {
		head: [],
		rows: []
	};
	#columnSizes = [];
	#renderer;
	#options;
	#colors;
	#renderFullWidth = false;
	#fluidColumnIndex = 0;
	#padding = 2;
	constructor(options = {}) {
		this.#options = {
			raw: options.raw === void 0 ? false : options.raw,
			chars: options.chars
		};
	}
	#storeColumnSize(columns) {
		columns.forEach((column, index) => {
			const size = stringWidth(column);
			const existingSize = this.#columnSizes[index];
			if (!existingSize || existingSize < size) this.#columnSizes[index] = size;
		});
	}
	#computeColumnsWidth() {
		if (!this.#renderFullWidth) return;
		let columns = TERMINAL_SIZE - (this.#columnSizes.length + 1);
		this.#state.colWidths = this.#state.colWidths || [];
		this.#columnSizes.forEach((column, index) => {
			this.#state.colWidths[index] = this.#state.colWidths[index] || column + this.#padding * 2;
			columns = columns - this.#state.colWidths[index];
		});
		if (columns) {
			const index = this.#fluidColumnIndex > this.#columnSizes.length - 1 ? 0 : this.#fluidColumnIndex;
			this.#state.colWidths[index] = this.#state.colWidths[index] + columns;
		}
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(color) {
		this.#colors = color;
		return this;
	}
	head(headColumns) {
		this.#state.head = headColumns;
		this.#storeColumnSize(headColumns.map((column) => typeof column === "string" ? column : column.content));
		return this;
	}
	row(row) {
		this.#state.rows.push(row);
		if (Array.isArray(row)) this.#storeColumnSize(row.map((cell) => typeof cell === "string" ? cell : cell.content));
		return this;
	}
	columnWidths(widths) {
		this.#state.colWidths = widths;
		return this;
	}
	fullWidth(renderFullWidth = true) {
		this.#renderFullWidth = renderFullWidth;
		return this;
	}
	fluidColumnIndex(index) {
		this.#fluidColumnIndex = index;
		return this;
	}
	render() {
		if (this.#options.raw) {
			this.getRenderer().log(this.#state.head.map((col) => typeof col === "string" ? col : col.content).join("|"));
			this.#state.rows.forEach((row) => {
				const content = Array.isArray(row) ? row.map((cell) => typeof cell === "string" ? cell : cell.content) : Object.keys(row);
				this.getRenderer().log(content.join("|"));
			});
			return;
		}
		this.#computeColumnsWidth();
		const cliTable = new CliTable({
			head: this.#state.head,
			style: {
				"head": [],
				"border": ["dim"],
				"padding-left": 2,
				"padding-right": 2
			},
			wordWrap: true,
			...this.#state.colWidths ? { colWidths: this.#state.colWidths } : {},
			chars: this.#options.chars
		});
		this.#state.rows.forEach((row) => cliTable.push(row));
		this.getRenderer().log(cliTable.toString());
	}
};
var Steps = class {
	#steps = [];
	#renderer;
	#colors;
	#options;
	constructor(options = {}) {
		this.#options = { raw: options.raw === void 0 ? false : options.raw };
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(colors) {
		this.#colors = colors;
		return this;
	}
	add(title, content) {
		this.#steps.push({
			title,
			content
		});
		return this;
	}
	prepare() {
		const colors = this.getColors();
		const lines = [];
		const stepCount = this.#steps.length;
		this.#steps.forEach((step, index) => {
			const stepNumber = index + 1;
			const isLast = stepNumber === stepCount;
			const counter = colors.cyan(`${stepNumber}.`);
			const title = colors.bold(step.title);
			lines.push(`${counter} ${title}`);
			if (step.content) step.content.split("\n").forEach((line) => {
				if (this.#options.raw) lines.push(line);
				else lines.push(`${colors.grey().dim(icons.borderVertical)}  ${line}`);
			});
			if (!isLast && !this.#options.raw) lines.push(colors.grey().dim(icons.borderVertical));
		});
		return lines.join("\n");
	}
	render() {
		const output = this.prepare();
		this.getRenderer().log(output);
	}
};
var Action = class {
	#startTime;
	#options;
	#message;
	#colors;
	#renderer;
	#displayDuration = false;
	constructor(message, options = {}) {
		this.#message = message;
		this.#startTime = process.hrtime();
		this.#options = { dim: options.dim === void 0 ? false : options.dim };
	}
	#formatLabel(label, color) {
		label = this.getColors()[color](`${label.toUpperCase()}:`);
		if (this.#options.dim) return this.getColors().dim(label);
		return label;
	}
	#formatMessage(message) {
		if (this.#options.dim) return this.getColors().dim(message);
		return message;
	}
	#formatSuffix(message) {
		message = `(${message})`;
		return this.getColors().dim(message);
	}
	#formatError(error) {
		return `\n    ${(typeof error === "string" ? error : error.stack || error.message).split("\n").map((line) => {
			if (this.#options.dim) line = this.getColors().dim(line);
			return `     ${this.getColors().red(line)}`;
		}).join("\n")}`;
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(color) {
		this.#colors = color;
		return this;
	}
	displayDuration(displayDuration = true) {
		this.#displayDuration = displayDuration;
		return this;
	}
	prepareSucceeded() {
		let logMessage = `${this.#formatLabel("done", "green")}    ${this.#formatMessage(this.#message)}`;
		if (this.#displayDuration) logMessage = `${logMessage} ${this.#formatSuffix(prettyHrtime(process.hrtime(this.#startTime)))}`;
		return logMessage;
	}
	succeeded() {
		this.getRenderer().log(this.prepareSucceeded());
	}
	prepareSkipped(skipReason) {
		let logMessage = `${this.#formatLabel("skipped", "cyan")} ${this.#formatMessage(this.#message)}`;
		if (skipReason) logMessage = `${logMessage} ${this.#formatSuffix(skipReason)}`;
		return logMessage;
	}
	skipped(skipReason) {
		this.getRenderer().log(this.prepareSkipped(skipReason));
	}
	prepareFailed(error) {
		return `${this.#formatLabel("failed", "red")}  ${this.#formatMessage(this.#message)} ${this.#formatError(error)}`;
	}
	failed(error) {
		this.getRenderer().logError(this.prepareFailed(error));
	}
};
var Spinner = class {
	#animator = {
		frames: [
			".  ",
			".. ",
			"...",
			" ..",
			"  .",
			"   "
		],
		interval: 200,
		index: 0,
		getFrame() {
			return this.frames[this.index];
		},
		advance() {
			this.index = this.index + 1 === this.frames.length ? 0 : this.index + 1;
			return this.index;
		}
	};
	#state = "idle";
	#message;
	#renderer;
	#spinnerWriter;
	constructor(message) {
		this.#message = message;
	}
	#animate() {
		if (this.#state !== "running") return;
		if (this.#message.silent) return;
		const frame = this.#animator.getFrame();
		if (this.#spinnerWriter) this.#spinnerWriter(`${this.#message.render()} ${frame}`);
		else this.getRenderer().logUpdate(`${this.#message.render()} ${frame}`);
		setTimeout(() => {
			this.#animator.advance();
			this.#animate();
		}, this.#animator.interval);
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	start() {
		this.#state = "running";
		this.#animate();
		return this;
	}
	update(text, options) {
		if (this.#state !== "running") return this;
		Object.assign(this.#message, {
			text,
			...options
		});
		return this;
	}
	stop() {
		this.#state = "stopped";
		this.#animator.index = 0;
		if (!this.#spinnerWriter && !this.#message.silent) {
			this.getRenderer().logUpdate(`${this.#message.render()} ${this.#animator.frames[2]}`);
			this.getRenderer().logUpdatePersist();
		}
	}
	tap(callback) {
		this.#spinnerWriter = callback;
		return this;
	}
};
var Logger = class {
	#options;
	#colors;
	#renderer;
	getLogs() {
		return this.getRenderer().getLogs();
	}
	flushLogs() {
		this.getRenderer().flushLogs();
	}
	constructor(options = {}) {
		const dimOutput = options.dim === void 0 ? false : options.dim;
		this.#options = {
			dim: dimOutput,
			dimLabels: options.dimLabels === void 0 ? dimOutput : options.dimLabels
		};
	}
	#colorizeLabel(color, text) {
		text = this.getColors()[color](text);
		if (this.#options.dimLabels) return `[ ${this.getColors().dim(text)} ]`;
		return `[ ${text} ]`;
	}
	#getLabel(type) {
		switch (type) {
			case "success": return this.#colorizeLabel("green", type);
			case "error":
			case "fatal": return this.#colorizeLabel("red", type);
			case "warning": return this.#colorizeLabel("yellow", "warn");
			case "info": return this.#colorizeLabel("blue", type);
			case "debug": return this.#colorizeLabel("cyan", type);
			case "await": return this.#colorizeLabel("cyan", "wait");
		}
	}
	#addSuffix(message, suffix) {
		if (!suffix) return message;
		return `${message} ${this.getColors().dim().yellow(`(${suffix})`)}`;
	}
	#addDuration(message, duration) {
		if (!duration) return message;
		return `${message} ${this.getColors().dim(`(${prettyHrtime(process.hrtime(duration))})`)}`;
	}
	#addPrefix(message, prefix) {
		if (!prefix) return message;
		prefix = prefix.replace(/%time%/, (/* @__PURE__ */ new Date()).toISOString());
		return `${this.getColors().dim(`[${prefix}]`)} ${message}`;
	}
	#prefixLabel(message, label) {
		return `${label} ${message}`;
	}
	#decorateMessage(message) {
		if (this.#options.dim) return this.getColors().dim(message);
		return message;
	}
	#formatStack(stack) {
		if (!stack) return "";
		return `\n${stack.split("\n").splice(1).map((line) => {
			if (this.#options.dim) line = this.getColors().dim(line);
			return `      ${this.getColors().red(line)}`;
		}).join("\n")}`;
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(color) {
		this.#colors = color;
		return this;
	}
	log(message) {
		this.getRenderer().log(message);
	}
	logUpdate(message) {
		this.getRenderer().logUpdate(message);
	}
	logUpdatePersist() {
		this.getRenderer().logUpdatePersist();
	}
	logError(message) {
		this.getRenderer().logError(message);
	}
	prepareSuccess(message, options) {
		message = this.#decorateMessage(message);
		message = this.#prefixLabel(message, this.#getLabel("success"));
		message = this.#addPrefix(message, options?.prefix);
		message = this.#addSuffix(message, options?.suffix);
		message = this.#addDuration(message, options?.startTime);
		return message;
	}
	success(message, options) {
		this.log(this.prepareSuccess(message, options));
	}
	prepareError(message, options) {
		message = typeof message === "string" ? message : message.message;
		message = this.#decorateMessage(message);
		message = this.#prefixLabel(message, this.#getLabel("error"));
		message = this.#addPrefix(message, options?.prefix);
		message = this.#addSuffix(message, options?.suffix);
		message = this.#addDuration(message, options?.startTime);
		return message;
	}
	error(message, options) {
		this.logError(this.prepareError(message, options));
	}
	prepareFatal(message, options) {
		const stack = this.#formatStack(typeof message === "string" ? void 0 : message.stack);
		message = typeof message === "string" ? message : message.message;
		message = this.#decorateMessage(message);
		message = this.#prefixLabel(message, this.#getLabel("error"));
		message = this.#addPrefix(message, options?.prefix);
		message = this.#addSuffix(message, options?.suffix);
		message = this.#addDuration(message, options?.startTime);
		return `${message}${stack}`;
	}
	fatal(message, options) {
		this.logError(this.prepareFatal(message, options));
	}
	prepareWarning(message, options) {
		message = this.#decorateMessage(message);
		message = this.#prefixLabel(message, this.#getLabel("warning"));
		message = this.#addPrefix(message, options?.prefix);
		message = this.#addSuffix(message, options?.suffix);
		message = this.#addDuration(message, options?.startTime);
		return message;
	}
	warning(message, options) {
		this.log(this.prepareWarning(message, options));
	}
	prepareInfo(message, options) {
		message = this.#decorateMessage(message);
		message = this.#prefixLabel(message, this.#getLabel("info"));
		message = this.#addPrefix(message, options?.prefix);
		message = this.#addSuffix(message, options?.suffix);
		message = this.#addDuration(message, options?.startTime);
		return message;
	}
	info(message, options) {
		this.log(this.prepareInfo(message, options));
	}
	prepareDebug(message, options) {
		message = this.#decorateMessage(message);
		message = this.#prefixLabel(message, this.#getLabel("debug"));
		message = this.#addPrefix(message, options?.prefix);
		message = this.#addSuffix(message, options?.suffix);
		message = this.#addDuration(message, options?.startTime);
		return message;
	}
	debug(message, options) {
		this.log(this.prepareDebug(message, options));
	}
	await(text, options) {
		return new Spinner({
			logger: this,
			text,
			...options,
			render() {
				let decorated = this.logger.#decorateMessage(this.text);
				decorated = this.logger.#prefixLabel(decorated, this.logger.#getLabel("await"));
				decorated = this.logger.#addPrefix(decorated, this.prefix);
				decorated = this.logger.#addSuffix(decorated, this.suffix);
				return decorated;
			}
		}).useRenderer(this.getRenderer());
	}
	action(title) {
		return new Action(title, { dim: this.#options.dim }).useColors(this.getColors()).useRenderer(this.getRenderer());
	}
	child(options) {
		return new this.constructor(options).useColors(this.getColors()).useRenderer(this.getRenderer());
	}
};
var cli_boxes_default = {
	single: {
		"topLeft": "┌",
		"top": "─",
		"topRight": "┐",
		"right": "│",
		"bottomRight": "┘",
		"bottom": "─",
		"bottomLeft": "└",
		"left": "│"
	},
	double: {
		"topLeft": "╔",
		"top": "═",
		"topRight": "╗",
		"right": "║",
		"bottomRight": "╝",
		"bottom": "═",
		"bottomLeft": "╚",
		"left": "║"
	},
	round: {
		"topLeft": "╭",
		"top": "─",
		"topRight": "╮",
		"right": "│",
		"bottomRight": "╯",
		"bottom": "─",
		"bottomLeft": "╰",
		"left": "│"
	},
	bold: {
		"topLeft": "┏",
		"top": "━",
		"topRight": "┓",
		"right": "┃",
		"bottomRight": "┛",
		"bottom": "━",
		"bottomLeft": "┗",
		"left": "┃"
	},
	singleDouble: {
		"topLeft": "╓",
		"top": "─",
		"topRight": "╖",
		"right": "║",
		"bottomRight": "╜",
		"bottom": "─",
		"bottomLeft": "╙",
		"left": "║"
	},
	doubleSingle: {
		"topLeft": "╒",
		"top": "═",
		"topRight": "╕",
		"right": "│",
		"bottomRight": "╛",
		"bottom": "═",
		"bottomLeft": "╘",
		"left": "│"
	},
	classic: {
		"topLeft": "+",
		"top": "-",
		"topRight": "+",
		"right": "|",
		"bottomRight": "+",
		"bottom": "-",
		"bottomLeft": "+",
		"left": "|"
	},
	arrow: {
		"topLeft": "↘",
		"top": "↓",
		"topRight": "↙",
		"right": "←",
		"bottomRight": "↖",
		"bottom": "↑",
		"bottomLeft": "↗",
		"left": "→"
	}
};
const BOX = cli_boxes_default.round;
var Instructions = class {
	#state = { content: [] };
	#renderer;
	#widestLineLength = 0;
	#leftPadding = 4;
	#rightPadding = 8;
	#paddingTop = 1;
	#paddingBottom = 1;
	#colors;
	#options;
	#drawBorder = (border, colors) => {
		return colors.dim(border);
	};
	constructor(options = {}) {
		this.#options = {
			icons: options.icons === void 0 ? true : options.icons,
			raw: options.raw === void 0 ? false : options.raw
		};
	}
	#getHorizontalLength() {
		return this.#widestLineLength + this.#leftPadding + this.#rightPadding;
	}
	#repeat(text, times) {
		return new Array(times + 1).join(text);
	}
	#wrapInVerticalLines(content, leftWhitespace, rightWhitespace) {
		return `${this.#drawBorder(BOX.left, this.getColors())}${leftWhitespace}${content}${rightWhitespace}${this.#drawBorder(BOX.right, this.getColors())}`;
	}
	#getTopLine() {
		const horizontalLength = this.#getHorizontalLength();
		const horizontalLine = this.#repeat(this.#drawBorder(BOX.top, this.getColors()), horizontalLength);
		return `${this.#drawBorder(BOX.topLeft, this.getColors())}${horizontalLine}${this.#drawBorder(BOX.topRight, this.getColors())}`;
	}
	#getBottomLine() {
		const horizontalLength = this.#getHorizontalLength();
		const horizontalLine = this.#repeat(this.#drawBorder(BOX.bottom, this.getColors()), horizontalLength);
		return `${this.#drawBorder(BOX.bottomLeft, this.getColors())}${horizontalLine}${this.#drawBorder(BOX.bottomRight, this.getColors())}`;
	}
	#getHeadingBorderBottom() {
		const horizontalLength = this.#getHorizontalLength();
		const horizontalLine = this.#repeat(this.#drawBorder(cli_boxes_default.single.top, this.getColors()), horizontalLength);
		return this.#wrapInVerticalLines(horizontalLine, "", "");
	}
	#getContentLine(line) {
		const leftWhitespace = this.#repeat(" ", this.#leftPadding);
		const rightWhitespace = this.#repeat(" ", this.#widestLineLength - line.width + this.#rightPadding);
		return this.#wrapInVerticalLines(line.text, leftWhitespace, rightWhitespace);
	}
	#getHeading() {
		if (!this.#state.heading) return;
		return this.#getContentLine(this.#state.heading);
	}
	#getBody() {
		if (!this.#state.content || !this.#state.content.length) return;
		const top = new Array(this.#paddingTop).fill("").map(this.#getEmptyLineNode);
		const bottom = new Array(this.#paddingBottom).fill("").map(this.#getEmptyLineNode);
		return top.concat(this.#state.content).concat(bottom).map((line) => this.#getContentLine(line)).join("\n");
	}
	#getEmptyLineNode() {
		return {
			text: "",
			width: 0
		};
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(color) {
		this.#colors = color;
		return this;
	}
	fullScreen() {
		this.#widestLineLength = TERMINAL_SIZE - (this.#leftPadding + this.#rightPadding) - 2;
		return this;
	}
	drawBorder(callback) {
		this.#drawBorder = callback;
		return this;
	}
	heading(text) {
		const width = stringWidth(text);
		if (width > this.#widestLineLength) this.#widestLineLength = width;
		this.#state.heading = {
			text,
			width
		};
		return this;
	}
	add(text) {
		text = this.#options.icons ? `${this.getColors().dim(icons.pointer)} ${text}` : `${text}`;
		const width = stringWidth(text);
		if (width > this.#widestLineLength) this.#widestLineLength = width;
		this.#state.content.push({
			text,
			width
		});
		return this;
	}
	prepare() {
		if (this.#options.raw) {
			let output = [];
			if (this.#state.heading) output.push(this.#state.heading.text);
			output = output.concat(this.#state.content.map(({ text }) => text));
			return output.join("\n");
		}
		const top = this.#getTopLine();
		const heading = this.#getHeading();
		const headingBorderBottom = this.#getHeadingBorderBottom();
		const body = this.#getBody();
		const bottom = this.#getBottomLine();
		let output = `${top}\n`;
		if (heading) output = `${output}${heading}`;
		if (heading && body) output = `${output}\n${headingBorderBottom}\n`;
		if (body) output = `${output}${body}`;
		return `${output}\n${bottom}`;
	}
	render() {
		this.getRenderer().log(this.prepare());
	}
};
var Task = class {
	#startTime;
	#lastLogLine;
	#updateListeners = [];
	#duration;
	#completionMessage;
	#state = "idle";
	constructor(title) {
		this.title = title;
	}
	#notifyListeners() {
		for (let listener of this.#updateListeners) listener(this);
	}
	getState() {
		return this.#state;
	}
	getDuration() {
		return this.#duration || null;
	}
	getError() {
		return this.#completionMessage || null;
	}
	getSuccessMessage() {
		return typeof this.#completionMessage === "string" ? this.#completionMessage : null;
	}
	getLastLoggedLine() {
		return this.#lastLogLine || null;
	}
	onUpdate(listener) {
		this.#updateListeners.push(listener);
		return this;
	}
	start() {
		this.#state = "running";
		this.#startTime = process.hrtime();
		this.#notifyListeners();
		return this;
	}
	update(message) {
		this.#lastLogLine = message;
		this.#notifyListeners();
		return this;
	}
	markAsSucceeded(message) {
		this.#state = "succeeded";
		this.#duration = prettyHrtime(process.hrtime(this.#startTime));
		this.#completionMessage = message;
		this.#notifyListeners();
		return this;
	}
	markAsFailed(error) {
		this.#state = "failed";
		this.#duration = prettyHrtime(process.hrtime(this.#startTime));
		this.#completionMessage = error;
		this.#notifyListeners();
		return this;
	}
};
var VerboseRenderer = class {
	#colors;
	#renderer;
	#registeredTasks = [];
	#notifiedTasks = /* @__PURE__ */ new Set();
	constructor() {}
	#formatError(error) {
		if (typeof error === "string") return `${this.#getAnsiIcon("│", "dim")}${this.getColors().red(error)}`;
		if (!error.stack) return `${this.#getAnsiIcon("│", "dim")}${this.getColors().red(error.message)}`;
		return `${error.stack.split("\n").map((line) => `${this.#getAnsiIcon("│", "dim")} ${this.getColors().red(line)}`).join("\n")}`;
	}
	#getAnsiIcon(icon, color) {
		return this.getColors()[color](`${icon} `);
	}
	#renderRunningTask(task) {
		if (this.#notifiedTasks.has(task.title)) {
			const lastLoggedLine = task.getLastLoggedLine();
			if (lastLoggedLine) this.getRenderer().log(`${this.#getAnsiIcon("│", "dim")}${lastLoggedLine}`);
			return;
		}
		this.getRenderer().log(`${this.#getAnsiIcon("┌", "dim")}${task.title}`);
		this.#notifiedTasks.add(task.title);
	}
	#renderSucceededTask(task) {
		const successMessage = task.getSuccessMessage();
		const icon = this.#getAnsiIcon("└", "dim");
		const status = this.getColors().green(successMessage || "Completed");
		const duration = this.getColors().dim(`(${task.getDuration()})`);
		this.getRenderer().log(`${icon}${status} ${duration}`);
	}
	#renderFailedTask(task) {
		const error = task.getError();
		if (error) this.getRenderer().logError(this.#formatError(error));
		const icon = this.#getAnsiIcon("└", "dim");
		const status = this.getColors().red("Failed");
		const duration = this.getColors().dim(`(${task.getDuration()})`);
		this.getRenderer().logError(`${icon}${status} ${duration}`);
	}
	#renderTask(task) {
		switch (task.getState()) {
			case "running": return this.#renderRunningTask(task);
			case "succeeded": return this.#renderSucceededTask(task);
			case "failed": return this.#renderFailedTask(task);
		}
	}
	#renderTasks() {
		this.#registeredTasks.forEach((task) => this.#renderTask(task));
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(color) {
		this.#colors = color;
		return this;
	}
	tasks(tasks) {
		this.#registeredTasks = tasks;
		return this;
	}
	render() {
		this.#registeredTasks.forEach((task) => task.onUpdate(($task) => this.#renderTask($task)));
		this.#renderTasks();
	}
};
var MinimalRenderer = class {
	#options;
	#colors;
	#renderer;
	#registeredTasks = [];
	constructor(options) {
		this.#options = { icons: options.icons === void 0 ? true : options.icons };
	}
	#formatError(error) {
		let message = typeof error === "string" ? error : error.message;
		message = this.getColors().red(message);
		return `\n  ${message.split("\n").map((line) => `${line}`).join("\n")}`;
	}
	#getPointerIcon(color) {
		const icon = this.#options.icons ? `${icons.pointer} ` : "";
		if (!icon) return icon;
		return this.getColors()[color](icon);
	}
	#renderIdleTask(task) {
		return `${this.#getPointerIcon("dim")}${this.getColors().dim(task.title)}`;
	}
	#renderRunningTask(task) {
		const lastLogLine = task.getLastLoggedLine();
		return `${this.#options.icons ? `${icons.pointer} ${task.title}` : task.title}\n  ${lastLogLine || ""}`;
	}
	#renderFailedTask(task) {
		const pointer = this.#getPointerIcon("red");
		const duration = this.getColors().dim(`(${task.getDuration()})`);
		let message = `${pointer}${task.title} ${duration}`;
		const error = task.getError();
		if (!error) return `${message}\n`;
		message = `${message}${this.#formatError(error)}`;
		return message;
	}
	#renderSucceededTask(task) {
		const pointer = this.#getPointerIcon("green");
		const duration = this.getColors().dim(`(${task.getDuration()})`);
		let message = `${pointer}${task.title} ${duration}`;
		const successMessage = task.getSuccessMessage();
		if (!successMessage) return `${message}\n`;
		message = `${message}\n  ${this.getColors().green(successMessage)}`;
		return message;
	}
	#renderTask(task) {
		switch (task.getState()) {
			case "idle": return this.#renderIdleTask(task);
			case "running": return this.#renderRunningTask(task);
			case "succeeded": return this.#renderSucceededTask(task);
			case "failed": return this.#renderFailedTask(task);
		}
	}
	#renderTasks() {
		const lastTaskState = this.#registeredTasks[this.#registeredTasks.length - 1].getState();
		this.getRenderer().logUpdate(this.#registeredTasks.map((task) => this.#renderTask(task)).join("\n"));
		if (lastTaskState === "succeeded" || lastTaskState === "failed") this.getRenderer().logUpdatePersist();
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(color) {
		this.#colors = color;
		return this;
	}
	tasks(tasks) {
		this.#registeredTasks = tasks;
		return this;
	}
	render() {
		this.#registeredTasks.forEach((task) => {
			task.onUpdate(() => this.#renderTasks());
		});
		this.#renderTasks();
	}
};
var RawRenderer = class {
	#colors;
	#renderer;
	#registeredTasks = [];
	#notifiedTasks = /* @__PURE__ */ new Set();
	constructor() {}
	#formatError(error) {
		if (typeof error === "string") return `${this.getColors().red(error)}`;
		if (!error.stack) return `${this.getColors().red(error.message)}`;
		return `${error.stack.split("\n").map((line) => ` ${this.getColors().red(line)}`).join("\n")}`;
	}
	#renderRunningTask(task) {
		if (this.#notifiedTasks.has(task.title)) {
			const lastLoggedLine = task.getLastLoggedLine();
			if (lastLoggedLine) this.getRenderer().log(lastLoggedLine);
			return;
		}
		this.getRenderer().log(`${task.title}\n${new Array(task.title.length + 1).join("-")}`);
		this.#notifiedTasks.add(task.title);
	}
	#renderSucceededTask(task) {
		const successMessage = task.getSuccessMessage();
		const status = this.getColors().green(successMessage || "completed");
		const duration = this.getColors().dim(`(${task.getDuration()})`);
		this.getRenderer().log(`${status} ${duration}\n`);
	}
	#renderFailedTask(task) {
		const error = task.getError();
		if (error) this.getRenderer().logError(this.#formatError(error));
		const status = this.getColors().red("failed");
		const duration = this.getColors().dim(`(${task.getDuration()})`);
		this.getRenderer().logError(`${status} ${duration}\n`);
	}
	#renderTask(task) {
		switch (task.getState()) {
			case "running": return this.#renderRunningTask(task);
			case "succeeded": return this.#renderSucceededTask(task);
			case "failed": return this.#renderFailedTask(task);
		}
	}
	#renderTasks() {
		this.#registeredTasks.forEach((task) => this.#renderTask(task));
	}
	getRenderer() {
		if (!this.#renderer) this.#renderer = new ConsoleRenderer();
		return this.#renderer;
	}
	useRenderer(renderer) {
		this.#renderer = renderer;
		return this;
	}
	getColors() {
		if (!this.#colors) this.#colors = useColors();
		return this.#colors;
	}
	useColors(color) {
		this.#colors = color;
		return this;
	}
	tasks(tasks) {
		this.#registeredTasks = tasks;
		return this;
	}
	render() {
		this.#registeredTasks.forEach((task) => task.onUpdate(($task) => this.#renderTask($task)));
		this.#renderTasks();
	}
};
function TRANSFORM_ERROR(error) {
	if (typeof error === "string") return {
		isError: true,
		message: error
	};
	return error;
}
var TaskManager = class {
	error;
	#options;
	#tasksRenderer;
	#tasks = [];
	#state = "idle";
	constructor(options = {}) {
		this.#options = {
			icons: options.icons === void 0 ? true : options.icons,
			raw: options.raw === void 0 ? false : options.raw,
			verbose: options.verbose === void 0 ? false : options.verbose
		};
		if (this.#options.raw) this.#tasksRenderer = new RawRenderer();
		else if (this.#options.verbose) this.#tasksRenderer = new VerboseRenderer();
		else this.#tasksRenderer = new MinimalRenderer({ icons: this.#options.icons });
	}
	async #runTask(index) {
		const task = this.#tasks[index];
		if (!task) return;
		task.task.start();
		const update = (logMessage) => {
			task.task.update(logMessage);
		};
		try {
			const response = await task.callback({
				error: TRANSFORM_ERROR,
				update
			});
			if (typeof response === "string") {
				task.task.markAsSucceeded(response);
				await this.#runTask(index + 1);
			} else {
				this.#state = "failed";
				task.task.markAsFailed(response);
			}
		} catch (error) {
			this.#state = "failed";
			this.error = error;
			task.task.markAsFailed(error);
		}
	}
	getState() {
		return this.#state;
	}
	add(title, callback) {
		this.#tasks.push({
			task: new Task(title),
			callback
		});
		return this;
	}
	addIf(conditional, title, callback) {
		if (conditional) this.add(title, callback);
		return this;
	}
	addUnless(conditional, title, callback) {
		if (!conditional) this.add(title, callback);
		return this;
	}
	tasks() {
		return this.#tasks.map(({ task }) => task);
	}
	getRenderer() {
		return this.#tasksRenderer.getRenderer();
	}
	useRenderer(renderer) {
		this.#tasksRenderer.useRenderer(renderer);
		return this;
	}
	useColors(color) {
		this.#tasksRenderer.useColors(color);
		return this;
	}
	async run() {
		if (this.#state !== "idle") return;
		this.#state = "running";
		this.#tasksRenderer.tasks(this.tasks()).render();
		await this.#runTask(0);
		if (this.#state === "running") this.#state = "succeeded";
	}
};
var MemoryRenderer = class {
	#logs = [];
	getLogs() {
		return this.#logs;
	}
	flushLogs() {
		this.#logs = [];
	}
	log(message) {
		this.#logs.push({
			message,
			stream: "stdout"
		});
	}
	logUpdate(message) {
		this.log(message);
	}
	logUpdatePersist() {}
	logError(message) {
		this.#logs.push({
			message,
			stream: "stderr"
		});
	}
};
function cliui(options = {}) {
	let mode = options.mode;
	if (!mode && !supportsColor.stdout) mode = "silent";
	let renderer = mode === "raw" ? new MemoryRenderer() : new ConsoleRenderer();
	let colors = useColors({
		silent: mode === "silent",
		raw: mode === "raw"
	});
	const logger = new Logger();
	logger.useRenderer(renderer);
	logger.useColors(colors);
	const instructions = () => {
		const instructionsInstance = new Instructions({
			icons: true,
			raw: mode === "raw"
		});
		instructionsInstance.useRenderer(renderer);
		instructionsInstance.useColors(colors);
		return instructionsInstance;
	};
	const sticker = () => {
		const instructionsInstance = new Instructions({
			icons: false,
			raw: mode === "raw"
		});
		instructionsInstance.useRenderer(renderer);
		instructionsInstance.useColors(colors);
		return instructionsInstance;
	};
	const tasks = (tasksOptions) => {
		const manager = new TaskManager({
			raw: mode === "raw",
			...tasksOptions
		});
		manager.useRenderer(renderer);
		manager.useColors(colors);
		return manager;
	};
	const table = (tableOptions) => {
		const tableInstance = new Table({
			raw: mode === "raw",
			...tableOptions
		});
		tableInstance.useRenderer(renderer);
		tableInstance.useColors(colors);
		return tableInstance;
	};
	const steps = () => {
		const stepsInstance = new Steps({ raw: mode === "raw" });
		stepsInstance.useRenderer(renderer);
		stepsInstance.useColors(colors);
		return stepsInstance;
	};
	return {
		colors,
		logger,
		table,
		tasks,
		steps,
		icons,
		sticker,
		instructions,
		switchMode(modeToUse) {
			mode = modeToUse;
			if (mode === "raw") this.useRenderer(new MemoryRenderer());
			else this.useRenderer(new ConsoleRenderer());
			this.useColors(useColors({
				silent: mode === "silent",
				raw: mode === "raw"
			}));
		},
		useRenderer(rendererToUse) {
			renderer = rendererToUse;
			logger.useRenderer(renderer);
		},
		useColors(colorsToUse) {
			colors = colorsToUse;
			logger.useColors(colors);
			this.colors = colors;
		}
	};
}
export { ConsoleRenderer, Instructions, Logger, MemoryRenderer, Steps, Table, TaskManager, cliui, poppinssColors as colors, icons };
