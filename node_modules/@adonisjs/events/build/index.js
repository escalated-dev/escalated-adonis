import {
  Emitter
} from "./chunk-5SLAVIHL.js";

// src/base_event.ts
import { RuntimeException } from "@poppinss/utils";
var BaseEvent = class {
  constructor(..._) {
  }
  /**
   * The emitter to use for dispatching events
   */
  static emitter;
  /**
   * Specify the emitter instance to use for dispatching events
   */
  static useEmitter(emitter) {
    this.emitter = emitter;
  }
  /**
   * Dispatch the current class as an event. The method takes the arguments
   * accepted by the class constructor.
   */
  static async dispatch(...args) {
    if (!this.emitter) {
      throw new RuntimeException(
        `Cannot dispatch "${this.name}" event. Make sure to pass emitter to the "BaseEvent" class for dispatch method to work`
      );
    }
    return this.emitter.emit(this, new this(...args));
  }
};
export {
  BaseEvent,
  Emitter
};
//# sourceMappingURL=index.js.map