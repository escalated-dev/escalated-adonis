// src/transports/memory.ts
function memory() {
  return () => new MemoryTransport();
}
var MemoryTransport = class _MemoryTransport {
  #id;
  /**
   * A Map that stores the subscriptions for each channel.
   */
  static #subscriptions = /* @__PURE__ */ new Map();
  setId(id) {
    this.#id = id;
    return this;
  }
  /**
   * List of messages received by this bus
   */
  receivedMessages = [];
  async publish(channel, message) {
    const handlers = _MemoryTransport.#subscriptions.get(channel);
    if (!handlers) {
      return;
    }
    for (const { handler, busId } of handlers) {
      if (busId === this.#id) continue;
      handler(message);
    }
  }
  async subscribe(channel, handler) {
    const handlers = _MemoryTransport.#subscriptions.get(channel) || [];
    handlers.push({ handler: this.#wrapHandler(handler), busId: this.#id });
    _MemoryTransport.#subscriptions.set(channel, handlers);
  }
  async unsubscribe(channel) {
    const handlers = _MemoryTransport.#subscriptions.get(channel) || [];
    _MemoryTransport.#subscriptions.set(
      channel,
      handlers.filter((h) => h.busId !== this.#id)
    );
  }
  async disconnect() {
    _MemoryTransport.#subscriptions.clear();
  }
  onReconnect(_callback) {
  }
  #wrapHandler(handler) {
    return (message) => {
      this.receivedMessages.push(message);
      handler(message);
    };
  }
};
export {
  MemoryTransport,
  memory
};
/**
 * @boringnode/bus
 *
 * @license MIT
 * @copyright BoringNode
 */
//# sourceMappingURL=memory.js.map