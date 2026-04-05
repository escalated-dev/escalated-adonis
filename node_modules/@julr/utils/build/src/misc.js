import {
  ms
} from "./chunk-Q7XCOBJX.js";

// src/misc.ts
import { setTimeout } from "node:timers/promises";
function hybridReturn(obj, arr) {
  const clone = { ...obj };
  Object.defineProperty(clone, Symbol.iterator, {
    enumerable: false,
    value() {
      let index = 0;
      return { next: () => ({ value: arr[index++], done: index > arr.length }) };
    }
  });
  return clone;
}
async function sleep(milliseconds) {
  return await setTimeout(ms.parse(milliseconds));
}
export {
  hybridReturn,
  sleep
};
