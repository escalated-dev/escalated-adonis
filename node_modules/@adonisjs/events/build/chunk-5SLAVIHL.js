// src/emitter.ts
import is2 from "@sindresorhus/is";
import Emittery from "emittery";
import { moduleCaller, moduleImporter } from "@adonisjs/fold";

// src/debug.ts
import { debuglog } from "node:util";
var debug_default = debuglog("adonisjs:events");

// src/events_buffer.ts
import is from "@sindresorhus/is";
import string from "@poppinss/utils/string";
import { AssertionError } from "node:assert";
var EventsBuffer = class {
  /**
   * Buffered events
   */
  #events = [];
  /**
   * Track emitted event
   */
  add(event, data) {
    this.#events.push({ event, data });
  }
  /**
   * Get all the emitted events
   */
  all() {
    return this.#events;
  }
  /**
   * Returns the size of captured events
   */
  size() {
    return this.#events.length;
  }
  /**
   * Find if an event was emitted
   */
  exists(event, finder) {
    return !!this.find(event, finder);
  }
  /**
   * Find a specific event
   */
  find(event, finder) {
    return this.#events.find((bufferedEvent) => {
      if (!finder) {
        return bufferedEvent.event === event;
      }
      return bufferedEvent.event === event && finder(bufferedEvent);
    }) || null;
  }
  /**
   * Assert a given event has been emitted
   */
  assertEmitted(event, finder) {
    const hasEvent = this.exists(event, finder);
    if (!hasEvent) {
      const message = is.class(event) ? `Expected "[class ${event.name}]" event to be emitted` : `Expected "${String(event)}" event to be emitted`;
      throw new AssertionError({
        message,
        expected: true,
        actual: false,
        operator: "strictEqual",
        stackStartFn: this.assertEmitted
      });
    }
  }
  /**
   * Assert number of times an event has been emitted
   */
  assertEmittedCount(event, count) {
    const actual = this.all().filter((bufferedEvent) => bufferedEvent.event === event).length;
    if (actual !== count) {
      const eventName = is.class(event) ? `[class ${event.name}]` : String(event);
      throw new AssertionError({
        message: `Expected "${eventName}" event to be emitted "${count}" ${string.pluralize(
          "time",
          count
        )}, instead it was emitted "${actual}" ${string.pluralize("time", actual)}`,
        actual,
        expected: count
      });
    }
  }
  /**
   * Assert a given event has been not been emitted
   */
  assertNotEmitted(event, finder) {
    const hasEvent = this.exists(event, finder);
    if (hasEvent) {
      const isClass = is.class(event);
      const message = isClass ? `Unexpected "[class ${event.name}]" event was emitted` : `Unexpected "${String(event)}" event was emitted`;
      throw new AssertionError({
        message,
        expected: false,
        actual: true,
        operator: "strictEqual",
        stackStartFn: this.assertNotEmitted
      });
    }
  }
  /**
   * Assert a given event has been not been emitted
   */
  assertNoneEmitted() {
    const eventsSize = this.size();
    if (eventsSize > 0) {
      throw new AssertionError(
        Object.assign(
          {
            message: `Expected zero events to be emitted. Instead received "${eventsSize}" ${string.pluralize(
              "event",
              eventsSize
            )}`,
            expected: 0,
            actual: eventsSize,
            operator: "strictEqual",
            stackStartFn: this.assertNoneEmitted
          },
          {
            showDiff: true
          }
        )
      );
    }
  }
  /**
   * Flush events collected within memory
   */
  flush() {
    this.#events = [];
  }
};

// src/emitter.ts
var Emitter = class {
  /**
   * Event classes to symbols mapping. We need symbols as emittery
   * does not support class based event names
   */
  #eventsClassSymbols = /* @__PURE__ */ new Map();
  /**
   * A collection of events and their listeners. We do not track listeners
   * listening for events only once
   */
  #eventsListeners = /* @__PURE__ */ new Map();
  /**
   * Underlying transport to emit events
   */
  #transport = new Emittery();
  /**
   * Events buffer. The events are collected inside an in-memory
   * buffer during fakes
   */
  #eventsBuffer;
  /**
   * A set of events to fake
   */
  #eventsToFake = /* @__PURE__ */ new Set();
  /**
   * Error handler to catch all errors thrown by listeners
   */
  #errorHandler;
  /**
   * Reference to AdonisJS application, we need the application root
   * and container reference from it.
   */
  #app;
  /**
   * Returns a map of events and their registered listeners. The
   * map key is the event name and the value is another map
   * of listeners.
   *
   * The listeners map key is the original binding listener
   * and the value is a callback function.
   */
  get eventsListeners() {
    return this.#eventsListeners;
  }
  constructor(app) {
    this.#app = app;
  }
  /**
   * Returns the symbol for a class based event.
   */
  #getEventClassSymbol(event) {
    if (!this.#eventsClassSymbols.has(event)) {
      this.#eventsClassSymbols.set(event, Symbol(event.name));
    }
    return this.#eventsClassSymbols.get(event);
  }
  /**
   * Normalizes the event to emittery supported data types. The class
   * constructors are cached against a unique symbol.
   */
  #resolveEvent(event) {
    if (is2.class(event)) {
      return this.#getEventClassSymbol(event);
    }
    return event;
  }
  /**
   * Returns the event listeners map
   */
  #getEventListeners(event) {
    if (!this.#eventsListeners.has(event)) {
      this.#eventsListeners.set(event, /* @__PURE__ */ new Map());
    }
    return this.#eventsListeners.get(event);
  }
  /**
   * Normalizes the event listener to a function that can be passed to
   * emittery.
   */
  #normalizeEventListener(listener) {
    if (typeof listener === "string") {
      const parts = listener.split(".");
      const method = parts.length === 1 ? "handle" : parts.pop();
      const moduleRefId = parts.join(".");
      return moduleImporter(() => this.#app.import(moduleRefId), method).toCallable(
        this.#app.container
      );
    }
    if (Array.isArray(listener)) {
      const listenerModule = listener[0];
      const method = listener[1] || "handle";
      if (is2.class(listenerModule)) {
        return moduleCaller(listenerModule, method).toCallable(this.#app.container);
      }
      return moduleImporter(listenerModule, method).toCallable(this.#app.container);
    }
    return listener;
  }
  /**
   * Resolves the event listener either from the cache or normalizes
   * it and stores it inside the cache
   */
  #resolveEventListener(event, listener) {
    const eventListeners = this.#getEventListeners(event);
    if (!eventListeners.has(listener)) {
      eventListeners.set(listener, this.#normalizeEventListener(listener));
    }
    return eventListeners.get(listener);
  }
  /**
   * Register a global error handler
   */
  onError(callback) {
    this.#errorHandler = callback;
    return this;
  }
  /**
   * Bind multiple listeners to listen for a single event. The listen
   * method is a convenience helper to be used with class based
   * events and listeners.
   */
  listen(event, listeners) {
    listeners.forEach((listener) => this.on(event, [listener, "handle"]));
  }
  on(event, listener) {
    if (debug_default.enabled) {
      debug_default("registering event listener, event: %O, listener: %O", event, listener);
    }
    const normalizedEvent = this.#resolveEvent(event);
    const normalizedListener = this.#resolveEventListener(event, listener);
    this.#transport.on(normalizedEvent, normalizedListener);
    return () => this.off(event, listener);
  }
  once(event, listener) {
    if (debug_default.enabled) {
      debug_default("registering one time event listener, event: %O, listener: %O", event, listener);
    }
    const normalizedEvent = this.#resolveEvent(event);
    const normalizedListener = this.#normalizeEventListener(listener);
    const off = this.#transport.on(normalizedEvent, async (data) => {
      off();
      debug_default("removing one time event listener, event: %O", event);
      await normalizedListener(data);
    });
  }
  /**
   * Attach a listener to listen for all the events. Wildcard listeners
   * can only be defined as inline callbacks.
   */
  onAny(listener) {
    return this.#transport.onAny(listener);
  }
  async emit(event, data) {
    if (this.#eventsToFake.has(event) || this.#eventsToFake.has("*")) {
      debug_default("faking emit. event: %O, data: %O", event, data);
      this.#eventsBuffer.add(event, data);
      return;
    }
    try {
      const normalizedEvent = this.#resolveEvent(event);
      await this.#transport.emit(normalizedEvent, data);
    } catch (error) {
      if (this.#errorHandler) {
        this.#errorHandler(event, error, data);
      } else {
        throw error;
      }
    }
  }
  async emitSerial(event, data) {
    if (this.#eventsToFake.has(event) || this.#eventsToFake.has("*")) {
      debug_default("faking emit. event: %O, data: %O", event, data);
      this.#eventsBuffer.add(event, data);
      return;
    }
    try {
      const normalizedEvent = this.#resolveEvent(event);
      await this.#transport.emitSerial(normalizedEvent, data);
    } catch (error) {
      if (this.#errorHandler) {
        this.#errorHandler(event, error, data);
      } else {
        throw error;
      }
    }
  }
  /**
   * Remove a specific listener for an event
   */
  off(event, listener) {
    if (debug_default.enabled) {
      debug_default("removing listener, event: %O, listener: %O", event, listener);
    }
    const normalizedEvent = this.#resolveEvent(event);
    const listeners = this.#getEventListeners(event);
    const normalizedListener = listeners.get(listener);
    if (!normalizedListener) {
      return;
    }
    listeners.delete(listener);
    this.#transport.off(normalizedEvent, normalizedListener);
  }
  /**
   * Remove a specific listener listening for all the events
   */
  offAny(listener) {
    this.#transport.offAny(listener);
    return this;
  }
  /**
   * Remove a specific listener for an event
   *
   * @alias "off"
   */
  clearListener(event, listener) {
    return this.off(event, listener);
  }
  /**
   * Clear all listeners for a specific event
   */
  clearListeners(event) {
    debug_default("clearing all listeners for event %O", event);
    this.#transport.clearListeners(this.#resolveEvent(event));
    this.#eventsListeners.delete(event);
  }
  /**
   * Clear all listeners for all the events
   */
  clearAllListeners() {
    debug_default("clearing all event listeners");
    this.#transport.clearListeners();
    this.#eventsListeners.clear();
  }
  /**
   * Get count of listeners for a given event or all the events
   */
  listenerCount(event) {
    return this.#transport.listenerCount(event ? this.#resolveEvent(event) : void 0);
  }
  /**
   * Find if an event has one or more listeners
   */
  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }
  /**
   * Fake one or more events. The listeners for faked events will
   * not be invoked.
   *
   * The return value is an events buffer that collects all the
   * events within memory.
   *
   * Calling this method one than once drops the existing fakes and
   * creates new one.
   */
  fake(events) {
    this.restore();
    this.#eventsBuffer = new EventsBuffer();
    if (!events) {
      debug_default("faking all events");
      this.#eventsToFake.add("*");
    } else {
      debug_default("faking events: %O", events);
      events.forEach((event) => this.#eventsToFake.add(event));
    }
    return this.#eventsBuffer;
  }
  /**
   * Restore fakes
   */
  restore() {
    debug_default("restoring existing fakes");
    this.#eventsToFake.clear();
    this.#eventsBuffer?.flush();
    this.#eventsBuffer = void 0;
  }
};

export {
  Emitter
};
//# sourceMappingURL=chunk-5SLAVIHL.js.map