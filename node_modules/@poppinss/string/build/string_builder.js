import { t as string_default } from "./string-ArFSN0fl.js";
import { extname } from "node:path";
var StringBuilder = class {
	#value;
	constructor(value) {
		this.#value = typeof value === "string" ? value : value.toString();
	}
	dashCase() {
		this.#value = string_default.dashCase(this.#value);
		return this;
	}
	dotCase() {
		this.#value = string_default.dotCase(this.#value);
		return this;
	}
	snakeCase() {
		this.#value = string_default.snakeCase(this.#value);
		return this;
	}
	pascalCase() {
		this.#value = string_default.pascalCase(this.#value);
		return this;
	}
	camelCase() {
		this.#value = string_default.camelCase(this.#value);
		return this;
	}
	capitalCase() {
		this.#value = string_default.capitalCase(this.#value);
		return this;
	}
	titleCase() {
		this.#value = string_default.titleCase(this.#value);
		return this;
	}
	sentenceCase() {
		this.#value = string_default.sentenceCase(this.#value);
		return this;
	}
	noCase() {
		this.#value = string_default.noCase(this.#value);
		return this;
	}
	plural() {
		this.#value = string_default.pluralize(this.#value);
		return this;
	}
	singular() {
		this.#value = string_default.singular(this.#value);
		return this;
	}
	slugify() {
		this.#value = string_default.slug(this.#value);
		return this;
	}
	removeSuffix(suffix, options) {
		if (options?.similarWords && options.similarWords.some((word) => new RegExp(`[-_]?${word}$`, "i").test(this.#value))) return this;
		this.#value = this.#value.replace(new RegExp(`[-_]?${suffix}$`, "i"), "");
		return this;
	}
	suffix(suffix, options) {
		this.removeSuffix(suffix, options);
		this.#value = `${this.#value}${suffix}`;
		return this;
	}
	removePrefix(prefix, options) {
		if (options?.similarWords && options.similarWords.some((word) => new RegExp(`^${word}[-_]?`, "i").test(this.#value))) return this;
		this.#value = this.#value.replace(new RegExp(`^${prefix}[-_]?`, "i"), "");
		return this;
	}
	prefix(prefix) {
		this.removePrefix(prefix);
		this.#value = `${prefix}${this.#value}`;
		return this;
	}
	removeExtension() {
		this.#value = this.#value.replace(/* @__PURE__ */ new RegExp(`${extname(this.#value)}$`), "");
		return this;
	}
	ext(extension) {
		this.removeExtension();
		this.#value = `${this.#value}.${extension.replace(/^\./, "")}`;
		return this;
	}
	toUnixSlash() {
		this.#value = string_default.toUnixSlash(this.#value);
		return this;
	}
	toString() {
		return this.#value;
	}
};
export { StringBuilder as default };
