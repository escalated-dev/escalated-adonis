// src/string/case.ts
import {
  camelCase as camelCaseBase,
  snakeCase as snakeCaseBase,
  kebabCase as kebabCaseBase,
  pascalCase as pascalCaseBase,
  capitalCase as capitalCaseBase
} from "case-anything";
function camelCase(value) {
  return camelCaseBase(value);
}
function snakeCase(value) {
  return snakeCaseBase(value);
}
function kebabCase(value) {
  return kebabCaseBase(value);
}
function pascalCase(value) {
  return pascalCaseBase(value);
}
function capitalCase(value) {
  return capitalCaseBase(value);
}
export {
  camelCase,
  capitalCase,
  kebabCase,
  pascalCase,
  snakeCase
};
