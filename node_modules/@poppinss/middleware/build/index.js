import { debuglog } from "node:util";
const debug = debuglog("poppinss:middleware");
function once(scope, callback) {
	function next() {
		if (next.called) return;
		next.called = true;
		debug("next invoked");
		return callback(scope);
	}
	next.called = false;
	return next;
}
const DEFAULT_FINAL_HANDLER = () => Promise.resolve();
var Runner = class {
	#middleware;
	#currentIndex = 0;
	#executor;
	#finalHandler = DEFAULT_FINAL_HANDLER;
	#errorHandler;
	constructor(middleware) {
		this.#middleware = middleware;
	}
	#invoke(self) {
		const middleware = self.#middleware[self.#currentIndex++];
		debug("running middleware at index", self.#currentIndex);
		if (!middleware) return self.#finalHandler();
		return self.#executor(middleware, once(self, self.#invoke));
	}
	#invokeWithErrorManagement(self) {
		const middleware = self.#middleware[self.#currentIndex++];
		debug("running middleware at index", self.#currentIndex);
		if (!middleware) return self.#finalHandler().catch(self.#errorHandler);
		return self.#executor(middleware, once(self, self.#invokeWithErrorManagement)).catch(self.#errorHandler);
	}
	finalHandler(finalHandler) {
		this.#finalHandler = finalHandler;
		return this;
	}
	errorHandler(errorHandler) {
		this.#errorHandler = errorHandler;
		return this;
	}
	async run(cb) {
		this.#executor = cb;
		debug("starting middleware chain with %d middleware", this.#middleware.length);
		if (this.#errorHandler) return this.#invokeWithErrorManagement(this);
		return this.#invoke(this);
	}
};
var Middleware = class {
	#middleware = /* @__PURE__ */ new Set();
	#middlewareArray;
	#isFrozen = false;
	all() {
		return this.#middleware;
	}
	has(handler) {
		return this.#middleware.has(handler);
	}
	add(handler) {
		if (this.#isFrozen) throw new Error("Middleware stack is frozen. Cannot add new middleware");
		this.#middleware.add(handler);
		return this;
	}
	remove(handler) {
		if (this.#isFrozen) throw new Error("Middleware stack is frozen. Cannot remove middleware");
		return this.#middleware.delete(handler);
	}
	clear() {
		if (this.#isFrozen) throw new Error("Middleware stack is frozen. Cannot clear middleware");
		this.#middleware.clear();
	}
	merge(hooks) {
		if (this.#isFrozen) throw new Error("Middleware stack is frozen. Cannot merge middleware");
		hooks.all().forEach((handler) => {
			this.add(handler);
		});
	}
	freeze() {
		if (this.#isFrozen) return;
		this.#isFrozen = true;
		this.#middlewareArray = [...this.all()];
	}
	runner() {
		this.freeze();
		return new Runner(this.#middlewareArray);
	}
};
export { Middleware as default };
