// src/string/ms.ts
import { parse, format } from "@lukeed/ms";
var ms = {
  /**
   * Formats milliseconds to pretty string output
   */
  format(milliseconds, long) {
    return format(milliseconds, long);
  },
  /**
   * Parse the time expression to milliseconds. If the unit value is a number,
   * then it will be returned as it is. Otherwise the string expression will
   * be converted to a number representing seconds.
   */
  parse(duration) {
    if (typeof duration === "number") {
      return duration;
    }
    const milliseconds = parse(duration);
    if (milliseconds === void 0) {
      throw new Error(`Invalid duration expression "${duration}"`);
    }
    return milliseconds;
  }
};

export {
  ms
};
