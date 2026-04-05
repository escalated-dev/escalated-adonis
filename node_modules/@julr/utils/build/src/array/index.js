// src/array/index.ts
function toArray(value) {
  return Array.isArray(value) ? value : [value];
}
function uniqBy(arr, mapper) {
  const map = /* @__PURE__ */ new Map();
  for (const item of arr) {
    const key = mapper(item);
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}
function uniq(arr) {
  return Array.from(new Set(arr));
}
function draw(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export {
  draw,
  toArray,
  uniq,
  uniqBy
};
