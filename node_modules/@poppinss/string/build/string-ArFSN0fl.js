import "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import slugifyPkg from "slugify";
import pluralizePkg from "pluralize";
import * as changeCase from "case-anything";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var import_bytes = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = bytes$1;
	module.exports.format = format$1;
	module.exports.parse = parse$1;
	var formatThousandsRegExp = /\B(?=(\d{3})+(?!\d))/g;
	var formatDecimalsRegExp = /(?:\.0*|(\.[^0]+)0+)$/;
	var map = {
		b: 1,
		kb: 1024,
		mb: 1 << 20,
		gb: 1 << 30,
		tb: Math.pow(1024, 4),
		pb: Math.pow(1024, 5)
	};
	var parseRegExp = /^((-|\+)?(\d+(?:\.\d+)?)) *(kb|mb|gb|tb|pb)$/i;
	function bytes$1(value, options) {
		if (typeof value === "string") return parse$1(value);
		if (typeof value === "number") return format$1(value, options);
		return null;
	}
	function format$1(value, options) {
		if (!Number.isFinite(value)) return null;
		var mag = Math.abs(value);
		var thousandsSeparator = options && options.thousandsSeparator || "";
		var unitSeparator = options && options.unitSeparator || "";
		var decimalPlaces = options && options.decimalPlaces !== void 0 ? options.decimalPlaces : 2;
		var fixedDecimals = Boolean(options && options.fixedDecimals);
		var unit = options && options.unit || "";
		if (!unit || !map[unit.toLowerCase()]) if (mag >= map.pb) unit = "PB";
		else if (mag >= map.tb) unit = "TB";
		else if (mag >= map.gb) unit = "GB";
		else if (mag >= map.mb) unit = "MB";
		else if (mag >= map.kb) unit = "KB";
		else unit = "B";
		var str = (value / map[unit.toLowerCase()]).toFixed(decimalPlaces);
		if (!fixedDecimals) str = str.replace(formatDecimalsRegExp, "$1");
		if (thousandsSeparator) str = str.split(".").map(function(s, i) {
			return i === 0 ? s.replace(formatThousandsRegExp, thousandsSeparator) : s;
		}).join(".");
		return str + unitSeparator + unit;
	}
	function parse$1(val) {
		if (typeof val === "number" && !isNaN(val)) return val;
		if (typeof val !== "string") return null;
		var results = parseRegExp.exec(val);
		var floatValue;
		var unit = "b";
		if (!results) {
			floatValue = parseInt(val, 10);
			unit = "b";
		} else {
			floatValue = parseFloat(results[1]);
			unit = results[4].toLowerCase();
		}
		if (isNaN(floatValue)) return null;
		return Math.floor(map[unit] * floatValue);
	}
})))(), 1);
var bytes_default = {
	format(valueInBytes, options) {
		return import_bytes.default.format(valueInBytes, options);
	},
	parse(unit) {
		if (typeof unit === "number") return unit;
		return import_bytes.default.parse(unit);
	}
};
let uuidGenerator = randomUUID;
function uuid(options) {
	return uuidGenerator(options);
}
uuid.use = function uuidUse(generator) {
	uuidGenerator = generator;
};
uuid.restore = function uuidRestore() {
	uuidGenerator = randomUUID;
};
var RGX = /^(-?(?:\d+)?\.?\d+) *(m(?:illiseconds?|s(?:ecs?)?))?(s(?:ec(?:onds?|s)?)?)?(m(?:in(?:utes?|s)?)?)?(h(?:ours?|rs?)?)?(d(?:ays?)?)?(w(?:eeks?|ks?)?)?(y(?:ears?|rs?)?)?$/, SEC = 1e3, MIN = SEC * 60, HOUR = MIN * 60, DAY = HOUR * 24, YEAR = DAY * 365.25;
function parse(val) {
	var num, arr = val.toLowerCase().match(RGX);
	if (arr != null && (num = parseFloat(arr[1]))) {
		if (arr[3] != null) return num * SEC;
		if (arr[4] != null) return num * MIN;
		if (arr[5] != null) return num * HOUR;
		if (arr[6] != null) return num * DAY;
		if (arr[7] != null) return num * DAY * 7;
		if (arr[8] != null) return num * YEAR;
		return num;
	}
}
function fmt(val, pfx, str, long) {
	var num = (val | 0) === val ? val : ~~(val + .5);
	return pfx + num + (long ? " " + str + (num != 1 ? "s" : "") : str[0]);
}
function format(num, long) {
	var pfx = num < 0 ? "-" : "", abs = num < 0 ? -num : num;
	if (abs < SEC) return num + (long ? " ms" : "ms");
	if (abs < MIN) return fmt(abs / SEC, pfx, "second", long);
	if (abs < HOUR) return fmt(abs / MIN, pfx, "minute", long);
	if (abs < DAY) return fmt(abs / HOUR, pfx, "hour", long);
	if (abs < YEAR) return fmt(abs / DAY, pfx, "day", long);
	return fmt(abs / YEAR, pfx, "year", long);
}
var seconds_default = {
	format(seconds, long) {
		return format(seconds * 1e3, long);
	},
	parse(duration) {
		if (typeof duration === "number") return duration;
		const milliseconds = parse(duration);
		if (milliseconds === void 0) throw new Error(`Invalid duration expression "${duration}"`);
		return Math.floor(milliseconds / 1e3);
	}
};
const slug = slugifyPkg;
const defaultGenerator = (size) => {
	const bits = (size + 1) * 6;
	const buffer = randomBytes(Math.ceil(bits / 8));
	return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "").slice(0, size);
};
let randomGenerator = defaultGenerator;
function random(size) {
	return randomGenerator(size);
}
random.use = function randomUse(generator) {
	randomGenerator = generator;
};
random.restore = function randomRestore() {
	randomGenerator = defaultGenerator;
};
var require_truncatise = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(exportTo) {
		"use strict";
		var selfClosingTags = [
			"area",
			"base",
			"br",
			"col",
			"embed",
			"hr",
			"img",
			"input",
			"keygen",
			"link",
			"menuitem",
			"meta",
			"param",
			"source",
			"track",
			"wbr"
		];
		var truncatise$2 = function(text, options) {
			var options = options || {}, text = (text || "").trim(), truncatedText = "", currentState = 0, isEndOfWord = false, currentTag = "", tagStack = [], nextChar = "";
			var charCounter = 0, wordCounter = 0, paragraphCounter = 0;
			var NOT_TAG = 0, TAG_START = 1, TAG_ATTRIBUTES = 2;
			options.TruncateBy = options.TruncateBy === void 0 || typeof options.TruncateBy !== "string" || !options.TruncateBy.match(/(word(s)?|character(s)?|paragraph(s)?)/) ? "words" : options.TruncateBy.toLowerCase();
			options.TruncateLength = options.TruncateLength === void 0 || typeof options.TruncateLength !== "number" ? 50 : options.TruncateLength;
			options.StripHTML = options.StripHTML === void 0 || typeof options.StripHTML !== "boolean" ? false : options.StripHTML;
			options.Strict = options.Strict === void 0 || typeof options.Strict !== "boolean" ? true : options.Strict;
			options.Suffix = options.Suffix === void 0 || typeof options.Suffix !== "string" ? "..." : options.Suffix;
			if (text === "" || text.length <= options.TruncateLength && options.StripHTML === false) return text;
			if (options.StripHTML) text = String(text).replace(/<br( \/)?>/gi, " ");
			if (options.StripHTML && !options.TruncateBy.match(/(paragraph(s)?)/)) text = String(text).replace(/<!--(.*?)-->/gm, "").replace(/<\/?[^>]+>/gi, "");
			text = String(text).replace(/<\/p>(\r?\n)+<p>/gm, "</p><p>");
			if (options.StripHTML && String(text).match(/\r?\n\r?\n/)) text = String(text).replace(/((.+)(\r?\n\r?\n|$))/gi, "<p>$2</p>");
			for (var pointer = 0; pointer < text.length; pointer++) {
				var currentChar = text[pointer];
				switch (currentChar) {
					case "<":
						if (currentState === NOT_TAG) {
							currentState = TAG_START;
							currentTag = "";
						}
						if (!options.StripHTML) truncatedText += currentChar;
						break;
					case ">":
						if (currentState === TAG_START || currentState === TAG_ATTRIBUTES) {
							currentState = NOT_TAG;
							currentTag = currentTag.toLowerCase();
							if (currentTag === "/p") {
								paragraphCounter++;
								if (options.StripHTML) truncatedText += " ";
							}
							if (selfClosingTags.indexOf(currentTag) === -1 && selfClosingTags.indexOf(currentTag + "/") === -1) if (currentTag.indexOf("/") >= 0) tagStack.pop();
							else tagStack.push(currentTag);
						}
						if (!options.StripHTML) truncatedText += currentChar;
						break;
					case " ":
						if (currentState === TAG_START) currentState = TAG_ATTRIBUTES;
						if (currentState === NOT_TAG) {
							wordCounter++;
							charCounter++;
						}
						if (currentState === NOT_TAG || !options.StripHTML) truncatedText += currentChar;
						break;
					default:
						if (currentState === NOT_TAG) charCounter++;
						if (currentState === TAG_START) currentTag += currentChar;
						if (currentState === NOT_TAG || !options.StripHTML) truncatedText += currentChar;
						break;
				}
				nextChar = text[pointer + 1] || "";
				isEndOfWord = options.Strict ? true : !currentChar.match(/[a-zA-ZÇ-Ü']/i) || !nextChar.match(/[a-zA-ZÇ-Ü']/i);
				if (options.TruncateBy.match(/word(s)?/i) && options.TruncateLength <= wordCounter) {
					truncatedText = truncatedText.replace(/\s+$/, "");
					break;
				}
				if (options.TruncateBy.match(/character(s)?/i) && options.TruncateLength <= charCounter && isEndOfWord) break;
				if (options.TruncateBy.match(/paragraph(s)?/i) && options.TruncateLength === paragraphCounter) break;
			}
			if (!options.StripHTML && tagStack.length > 0) while (tagStack.length > 0) {
				var tag = tagStack.pop();
				if (tag !== "!--") truncatedText += "</" + tag + ">";
			}
			if (pointer < text.length - 1) if (truncatedText.match(/<\/p>$/gi)) truncatedText = truncatedText.replace(/(<\/p>)$/gi, options.Suffix + "$1");
			else truncatedText = truncatedText + options.Suffix;
			return truncatedText.trim();
		};
		if (typeof module !== "undefined" && module.exports) return module.exports = truncatise$2;
		exportTo.truncatise = truncatise$2;
	})(exports);
}));
var import_truncatise$1 = /* @__PURE__ */ __toESM(require_truncatise(), 1);
function excerpt(sentence$1, charactersLimit, options) {
	return (0, import_truncatise$1.default)(sentence$1, {
		TruncateLength: charactersLimit,
		Strict: options && options.completeWords === true ? false : true,
		StripHTML: true,
		TruncateBy: "characters",
		Suffix: options && options.suffix
	});
}
function applyPadding(value, options) {
	if (options.paddingLeft) value = `${options.paddingChar.repeat(options.paddingLeft)}${value}`;
	if (options.paddingRight) value = `${value}${options.paddingChar.repeat(options.paddingRight)}`;
	return value;
}
function justify(columns, options) {
	const normalizedOptions = {
		align: "left",
		indent: " ",
		...options
	};
	return columns.map((column) => {
		const columnWidth = options.getLength?.(column) ?? column.length;
		if (columnWidth >= normalizedOptions.width) return column;
		if (normalizedOptions.align === "left") return applyPadding(column, {
			paddingChar: normalizedOptions.indent,
			paddingRight: normalizedOptions.width - columnWidth
		});
		return applyPadding(column, {
			paddingChar: normalizedOptions.indent,
			paddingLeft: normalizedOptions.width - columnWidth
		});
	});
}
function ordinal(value) {
	const transformedValue = Math.abs(typeof value === "string" ? Number.parseInt(value) : value);
	if (!Number.isFinite(transformedValue) || Number.isNaN(transformedValue)) throw new Error("Cannot ordinalize invalid or infinite numbers");
	const percent = transformedValue % 100;
	if (percent >= 10 && percent <= 20) return `${value}th`;
	switch (transformedValue % 10) {
		case 1: return `${value}st`;
		case 2: return `${value}nd`;
		case 3: return `${value}rd`;
		default: return `${value}th`;
	}
}
var import_truncatise = /* @__PURE__ */ __toESM(require_truncatise(), 1);
function truncate(sentence$1, charactersLimit, options) {
	return (0, import_truncatise.default)(sentence$1, {
		TruncateLength: charactersLimit,
		Strict: options && options.completeWords === true ? false : true,
		StripHTML: false,
		TruncateBy: "characters",
		Suffix: options && options.suffix
	});
}
function sentence(values, options) {
	if (values.length === 0) return "";
	if (values.length === 1) return values[0];
	if (values.length === 2) return `${values[0]}${options?.pairSeparator || " and "}${values[1]}`;
	const normalized = Object.assign({
		separator: ", ",
		lastSeparator: ", and "
	}, options);
	return `${values.slice(0, -1).join(normalized.separator)}${normalized.lastSeparator}${values[values.length - 1]}`;
}
function wordWrap(value, options) {
	const width = options.width;
	const indent = options.indent ?? "";
	const newLine = `${options.newLine ?? "\n"}${indent}`;
	let regexString = ".{1," + width + "}";
	regexString += "([\\s​]+|$)|[^\\s​]+?([\\s​]+|$)";
	const re = new RegExp(regexString, "g");
	return (value.match(re) || []).map(function(line) {
		if (line.slice(-1) === "\n") line = line.slice(0, line.length - 1);
		return options.escape ? options.escape(line) : line;
	}).join(newLine);
}
var milliseconds_default = {
	format(milliseconds, long) {
		return format(milliseconds, long);
	},
	parse(duration) {
		if (typeof duration === "number") return duration;
		const milliseconds = parse(duration);
		if (milliseconds === void 0) throw new Error(`Invalid duration expression "${duration}"`);
		return milliseconds;
	}
};
function htmlEscape(value) {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function parseProp(data, key) {
	const tokens = key.split(".");
	while (tokens.length) {
		if (data === null || typeof data !== "object") return;
		const token = tokens.shift();
		data = Object.hasOwn(data, token) ? data[token] : void 0;
	}
	return data;
}
function interpolate(input, data) {
	return input.replace(/(\\)?{{(.*?)}}/g, (_, escapeChar, key) => {
		if (escapeChar) return `{{${key}}}`;
		return parseProp(data, key.trim());
	});
}
function toUnixSlash(path) {
	if (path.startsWith("\\\\?\\")) return path;
	return path.replace(/\\/g, "/");
}
function pluralize(word, count, inclusive) {
	return pluralizePkg(word, count, inclusive);
}
pluralize.addPluralRule = pluralizePkg.addPluralRule;
pluralize.addSingularRule = pluralizePkg.addSingularRule;
pluralize.addIrregularRule = pluralizePkg.addIrregularRule;
pluralize.addUncountableRule = pluralizePkg.addUncountableRule;
const plural = pluralizePkg.plural;
const singular = pluralizePkg.singular;
const isPlural = pluralizePkg.isPlural;
const isSingular = pluralizePkg.isSingular;
const NO_CASE_SPLIT_REGEXP = [/([a-z0-9])([A-Z])/g, /([A-Z])([A-Z][a-z])/g];
const NO_CASE_STRIP_REGEXP = /[^A-Z0-9]+/gi;
const SMALL_WORDS = /\b(?:an?d?|a[st]|because|but|by|en|for|i[fn]|neither|nor|o[fnr]|only|over|per|so|some|tha[tn]|the|to|up|upon|vs?\.?|versus|via|when|with|without|yet)\b/i;
const TOKENS = /[^\s:–—-]+|./g;
const WHITESPACE = /\s/;
const IS_MANUAL_CASE = /.(?=[A-Z]|\..)/;
const ALPHANUMERIC_PATTERN = /[A-Za-z0-9\u00C0-\u00FF]/;
function titleCase(input) {
	let output = "";
	let result;
	while ((result = TOKENS.exec(input)) !== null) {
		const { 0: token, index } = result;
		if (!IS_MANUAL_CASE.test(token) && (!SMALL_WORDS.test(token) || index === 0 || index + token.length === input.length) && (input.charAt(index + token.length) !== ":" || WHITESPACE.test(input.charAt(index + token.length + 1)))) {
			output += token.replace(ALPHANUMERIC_PATTERN, (char) => char.toUpperCase());
			continue;
		}
		output += token;
	}
	return output;
}
function camelCase(value) {
	return changeCase.camelCase(value);
}
function snakeCase(value) {
	return changeCase.snakeCase(value);
}
function dashCase(value, options) {
	if (options && options.capitalize) return changeCase.trainCase(value);
	return changeCase.kebabCase(value);
}
function pascalCase(value) {
	return changeCase.pascalCase(value);
}
function capitalCase(value) {
	return changeCase.capitalCase(value);
}
function sentenceCase(value) {
	return noCase(value, (input, index) => {
		const result = input.toLowerCase();
		if (index === 0) return input.charAt(0).toUpperCase() + input.substring(1);
		return result;
	});
}
function dotCase(value, options) {
	const transformedValue = changeCase.dotNotation(value);
	if (options && options.lowerCase) return transformedValue.toLowerCase();
	return transformedValue;
}
function noCase(value, transform) {
	let result = NO_CASE_SPLIT_REGEXP.reduce((input, regex) => input.replace(regex, "$1\0$2"), value);
	result = result.replace(NO_CASE_STRIP_REGEXP, "\0");
	let start = 0;
	let end = result.length;
	while (result.charAt(start) === "\0") start++;
	while (result.charAt(end - 1) === "\0") end--;
	return result.slice(start, end).split("\0").map(transform || ((input) => input.toLowerCase())).join(" ");
}
function condenseWhitespace(value) {
	return value.trim().replace(/\s{2,}/g, " ");
}
var string_default = {
	excerpt,
	truncate,
	slug,
	interpolate,
	plural,
	pluralize,
	singular,
	isPlural,
	isSingular,
	camelCase,
	capitalCase,
	dashCase,
	dotCase,
	noCase,
	pascalCase,
	sentenceCase,
	snakeCase,
	titleCase,
	random,
	sentence,
	condenseWhitespace,
	wordWrap,
	seconds: seconds_default,
	milliseconds: milliseconds_default,
	bytes: bytes_default,
	ordinal,
	htmlEscape,
	justify,
	uuid,
	toUnixSlash
};
export { string_default as t };
