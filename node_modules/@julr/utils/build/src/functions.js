// src/functions.ts
function once(func) {
  let called = false;
  let cache;
  return function(...args) {
    if (!called) {
      called = true;
      cache = func(...args);
    }
    return cache;
  };
}
function noop() {
}
async function asyncNoop() {
}
function invoke(fn) {
  return fn?.();
}
function batchInvoke(functions) {
  functions.forEach((fn) => fn && fn());
}
async function tryAsync(fn) {
  try {
    return [await fn?.(), null];
  } catch (throwable) {
    if (throwable instanceof Error) return [null, throwable];
    throw throwable;
  }
}
export {
  asyncNoop,
  batchInvoke,
  invoke,
  noop,
  once,
  tryAsync
};
