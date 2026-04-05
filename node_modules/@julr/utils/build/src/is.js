// src/is.ts
function isBoolean(val) {
  return typeof val === "boolean";
}
function isNumber(val) {
  return typeof val === "number";
}
function isString(val) {
  return typeof val === "string";
}
function isFunction(value) {
  return typeof value === "function";
}
function isObject(value) {
  return !isNull(value) && (typeof value === "object" || isFunction(value));
}
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}
function isUndefined(value) {
  return value === void 0;
}
function isNull(value) {
  return value === null;
}
function isNullOrUndefined(value) {
  return isNull(value) || isUndefined(value);
}
function isTruthy(value) {
  return Boolean(value);
}
function isArray(value, assertion) {
  if (!Array.isArray(value)) return false;
  if (!isFunction(assertion)) return true;
  return value.every((element) => assertion(element));
}
function isClass(value) {
  return isFunction(value) && value.toString().startsWith("class ");
}
function isPositiveNumber(value) {
  return isNumber(value) && value > 0;
}
function isFalsy(value) {
  return !value;
}
var is = {
  boolean: isBoolean,
  number: isNumber,
  string: isString,
  function: isFunction,
  object: isObject,
  plainObject: isPlainObject,
  undefined: isUndefined,
  null: isNull,
  nullOrUndefined: isNullOrUndefined,
  truthy: isTruthy,
  array: isArray,
  class: isClass,
  positiveNumber: isPositiveNumber,
  falsy: isFalsy
};
export {
  is,
  isBoolean,
  isFalsy,
  isFunction,
  isNull,
  isNullOrUndefined,
  isNumber,
  isObject,
  isPlainObject,
  isPositiveNumber,
  isString,
  isTruthy,
  isUndefined
};
