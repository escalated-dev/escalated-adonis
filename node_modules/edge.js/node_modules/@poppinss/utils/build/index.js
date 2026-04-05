import { n as __toESM } from "./chunk-BNZ4_A-W.js";
import { n as isScriptFile, r as naturalSort, t as require_main } from "./main-CdreHl1_.js";
import { r as RuntimeException } from "./exception-L7vjh-Gv.js";
import { n as safeParse, t as safeStringify } from "./main-aO4h7ygK.js";
import { flattie } from "flattie";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import string from "@poppinss/string";
const REDACTED = "[redacted]";
var Secret = class Secret {
	#value;
	#keyword;
	constructor(value, redactedKeyword) {
		this.#value = value;
		this.#keyword = redactedKeyword || REDACTED;
	}
	toJSON() {
		return this.#keyword;
	}
	valueOf() {
		return this.#keyword;
	}
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return this.#keyword;
	}
	toLocaleString() {
		return this.#keyword;
	}
	toString() {
		return this.#keyword;
	}
	release() {
		return this.#value;
	}
	map(transformFunc) {
		return new Secret(transformFunc(this.#value));
	}
};
function compose(superclass, ...mixins) {
	return mixins.reduce((c, mixin) => mixin(c), superclass);
}
function flatten(input, glue, keepNullish) {
	return flattie(input, glue, keepNullish);
}
function safeEqual(trustedValue, userInput) {
	if (typeof trustedValue === "string" && typeof userInput === "string") {
		const trustedLength = Buffer.byteLength(trustedValue);
		const trustedValueBuffer = Buffer.alloc(trustedLength, 0, "utf-8");
		trustedValueBuffer.write(trustedValue);
		const userValueBuffer = Buffer.alloc(trustedLength, 0, "utf-8");
		userValueBuffer.write(userInput);
		return timingSafeEqual(trustedValueBuffer, userValueBuffer) && trustedLength === Buffer.byteLength(userInput);
	}
	return timingSafeEqual(Buffer.from(trustedValue), Buffer.from(userInput));
}
async function importDefault(importFn, filePath) {
	const moduleExports = await importFn();
	if (!("default" in moduleExports)) throw new RuntimeException(filePath ? `Missing "export default" in module "${filePath}"` : `Missing "export default" from lazy import "${importFn}"`, { cause: { source: importFn } });
	return moduleExports.default;
}
var MessageBuilder = class {
	#getExpiryDate(expiresIn) {
		if (!expiresIn) return;
		const expiryMs = string.milliseconds.parse(expiresIn);
		return new Date(Date.now() + expiryMs);
	}
	#isExpired(message) {
		if (!message.expiryDate) return false;
		const expiryDate = new Date(message.expiryDate);
		return Number.isNaN(expiryDate.getTime()) || expiryDate < /* @__PURE__ */ new Date();
	}
	build(message, expiresIn, purpose) {
		return safeStringify({
			message,
			purpose,
			expiryDate: this.#getExpiryDate(expiresIn)
		});
	}
	verify(message, purpose) {
		const parsed = safeParse(message);
		if (typeof parsed !== "object" || !parsed) return null;
		if (!parsed.message) return null;
		if (parsed.purpose !== purpose) return null;
		if (this.#isExpired(parsed)) return null;
		return parsed.message;
	}
};
var ImportsBag = class {
	#imports = /* @__PURE__ */ new Map();
	#generateImportStatement(imp) {
		const parts = [];
		if (imp.defaultImport || imp.namedImports && imp.namedImports.length > 0) {
			const importParts = [];
			if (imp.defaultImport) importParts.push(imp.defaultImport);
			if (imp.namedImports && imp.namedImports.length > 0) importParts.push(`{ ${imp.namedImports.join(", ")} }`);
			parts.push(`import ${importParts.join(", ")} from '${imp.source}'`);
		}
		if (imp.defaultTypeImport || imp.typeImports && imp.typeImports.length > 0) {
			const typeImportParts = [];
			if (imp.defaultTypeImport) typeImportParts.push(imp.defaultTypeImport);
			if (imp.typeImports && imp.typeImports.length > 0) typeImportParts.push(`{ ${imp.typeImports.join(", ")} }`);
			parts.push(`import type ${typeImportParts.join(", ")} from '${imp.source}'`);
		}
		return parts.join("\n");
	}
	add(importInfo) {
		const existing = this.#imports.get(importInfo.source);
		if (existing) {
			if (importInfo.defaultImport) existing.defaultImport = importInfo.defaultImport;
			if (importInfo.defaultTypeImport) existing.defaultTypeImport = importInfo.defaultTypeImport;
			if (importInfo.namedImports) {
				if (!existing.namedImports) existing.namedImports = [];
				existing.namedImports.push(...importInfo.namedImports);
			}
			if (importInfo.typeImports) {
				if (!existing.typeImports) existing.typeImports = [];
				existing.typeImports.push(...importInfo.typeImports);
			}
		} else this.#imports.set(importInfo.source, {
			source: importInfo.source,
			defaultImport: importInfo.defaultImport,
			defaultTypeImport: importInfo.defaultTypeImport,
			namedImports: importInfo.namedImports ? [...importInfo.namedImports] : void 0,
			typeImports: importInfo.typeImports ? [...importInfo.typeImports] : void 0
		});
		return this;
	}
	toArray() {
		return Array.from(this.#imports.values()).map((imp) => ({
			source: imp.source,
			defaultImport: imp.defaultImport,
			defaultTypeImport: imp.defaultTypeImport,
			namedImports: imp.namedImports ? [...new Set(imp.namedImports)] : void 0,
			typeImports: imp.typeImports ? [...new Set(imp.typeImports)] : void 0
		}));
	}
	toString() {
		return this.toArray().map((imp) => this.#generateImportStatement(imp)).join("\n");
	}
};
var import_main = /* @__PURE__ */ __toESM(require_main());
function defineStaticProperty(self, propertyName, { initialValue, strategy }) {
	if (!self.hasOwnProperty(propertyName)) {
		const value = self[propertyName];
		if (strategy === "define" || value === void 0) {
			Object.defineProperty(self, propertyName, {
				value: initialValue,
				configurable: true,
				enumerable: true,
				writable: true
			});
			return;
		}
		Object.defineProperty(self, propertyName, {
			value: typeof strategy === "function" ? strategy(value) : import_main.default.cloneDeep(value),
			configurable: true,
			enumerable: true,
			writable: true
		});
	}
}
function detectAIAgent() {
	if (process.env.CLAUDECODE === "1") return "claude";
	if (process.env.GEMINI_CLI === "1") return "gemini";
	if (process.env.GITHUB_COPILOT_CLI_MODE === "1") return "copilot";
	if (process.env.WINDSURF_SESSION === "1" || process.env.TERM_PROGRAM === "windsurf") return "windsurf";
	if (process.env.CODEX_CLI === "1" || process.env.CODEX_SANDBOX === "1") return "codex";
	if (process.env.OPENCODE === "1") return "opencode";
	if (process.env.CURSOR_AGENT === "1") return "cursor";
	return null;
}
function isRunningInAIAgent() {
	return detectAIAgent() !== null;
}
export { ImportsBag, MessageBuilder, Secret, compose, defineStaticProperty, detectAIAgent, flatten, importDefault, isRunningInAIAgent, isScriptFile, naturalSort, safeEqual };
