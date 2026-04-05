// src/string/index.ts
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
function randomStr(size = 16, dict = urlAlphabet) {
  let id = "";
  let i = size;
  const len = dict.length;
  while (i--) {
    id += dict[Math.random() * len | 0];
  }
  return id;
}
function ensureStartsWith(prefix, str) {
  if (str.startsWith(prefix)) return str;
  return prefix + str;
}
function removePrefix(prefix, str) {
  if (str.startsWith(prefix)) return str.slice(prefix.length);
  return str;
}
function removeSuffix(suffix, str) {
  if (str.endsWith(suffix)) return str.slice(0, -suffix.length);
  return str;
}
export {
  capitalize,
  ensureStartsWith,
  randomStr,
  removePrefix,
  removeSuffix
};
