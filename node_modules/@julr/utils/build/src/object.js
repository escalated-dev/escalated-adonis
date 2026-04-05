// src/object.ts
function mapEntries(obj, toEntry) {
  if (!obj) return {};
  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      const [newKey, newValue] = toEntry(key, value);
      acc[newKey] = newValue;
      return acc;
    },
    {}
  );
}
function mapKeys(obj, mapFunc) {
  const keys = Object.keys(obj);
  return keys.reduce(
    (acc, key) => {
      acc[mapFunc(key, obj[key])] = obj[key];
      return acc;
    },
    {}
  );
}
function mapValues(obj, mapFunc) {
  return Object.keys(obj).reduce(
    (acc, key) => {
      acc[key] = mapFunc(obj[key], key);
      return acc;
    },
    {}
  );
}
function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}
function pickBy(obj, shouldPick) {
  const result = {};
  const keys = Object.keys(obj);
  for (const key of keys) {
    const value = obj[key];
    if (shouldPick(value, key)) {
      result[key] = value;
    }
  }
  return result;
}
function omit(obj, keys) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}
function omitBy(obj, shouldOmit) {
  const result = {};
  const keys = Object.keys(obj);
  for (const key of keys) {
    const value = obj[key];
    if (!shouldOmit(value, key)) result[key] = value;
  }
  return result;
}
function get(value, path, defaultValue) {
  const segments = path.split(/[.[\]]/g);
  let current = value;
  for (const key of segments) {
    if (current === null) return defaultValue;
    if (current === void 0) return defaultValue;
    const unquotedKey = key.replace(/["']/g, "");
    if (unquotedKey.trim() === "") continue;
    current = current[unquotedKey];
  }
  if (current === void 0) return defaultValue;
  return current;
}
export {
  get,
  mapEntries,
  mapKeys,
  mapValues,
  omit,
  omitBy,
  pick,
  pickBy
};
