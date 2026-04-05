import {
  AuthManager,
  Authenticator,
  AuthenticatorClient
} from "./chunk-SAW2RPCA.js";
import "./chunk-2VRS2VHB.js";
import {
  errors_exports
} from "./chunk-MUPAP5IP.js";
import {
  __export
} from "./chunk-UXA4FHST.js";

// configure.ts
import { presetAuth } from "@adonisjs/presets/auth";
async function configure(command) {
  const codemods = await command.createCodemods();
  let guard = command.parsedFlags.guard;
  if (guard === void 0) {
    guard = await command.prompt.choice(
      "Select the auth guard you want to use",
      [
        {
          name: "session",
          message: "Session"
        },
        {
          name: "access_tokens",
          message: "Opaque access tokens"
        },
        {
          name: "basic_auth",
          message: "Basic Auth"
        }
      ],
      {
        validate(value) {
          return !!value;
        }
      }
    );
  }
  if (!["session", "access_tokens", "basic_auth"].includes(guard)) {
    command.logger.error(
      `The selected guard "${guard}" is invalid. Select one from: session, access_tokens, basic_auth`
    );
    command.exitCode = 1;
    return;
  }
  await presetAuth(codemods, command.app, {
    guard,
    userProvider: "lucid"
  });
}

// src/symbols.ts
var symbols_exports = {};
__export(symbols_exports, {
  GUARD_KNOWN_EVENTS: () => GUARD_KNOWN_EVENTS,
  PROVIDER_REAL_USER: () => PROVIDER_REAL_USER
});
var PROVIDER_REAL_USER = /* @__PURE__ */ Symbol.for("PROVIDER_REAL_USER");
var GUARD_KNOWN_EVENTS = /* @__PURE__ */ Symbol.for("GUARD_KNOWN_EVENTS");

// src/define_config.ts
import { configProvider } from "@adonisjs/core";
function defineConfig(config) {
  return configProvider.create(async (app) => {
    const guardsList = Object.keys(config.guards);
    const guards = {};
    for (let guardName of guardsList) {
      const guard = config.guards[guardName];
      if (typeof guard === "function") {
        guards[guardName] = guard;
      } else {
        guards[guardName] = await guard.resolver(guardName, app);
      }
    }
    return {
      default: config.default,
      guards
    };
  });
}

// index.ts
function isModuleInstalled(moduleName) {
  try {
    import.meta.resolve(moduleName);
    return true;
  } catch (e) {
    return false;
  }
}
var withAuthFinder;
if (isModuleInstalled("@adonisjs/lucid")) {
  const { withAuthFinder: withAuthFinderFn } = await import("./src/mixins/lucid.js");
  withAuthFinder = withAuthFinderFn;
}
export {
  AuthManager,
  Authenticator,
  AuthenticatorClient,
  configure,
  defineConfig,
  errors_exports as errors,
  symbols_exports as symbols,
  withAuthFinder
};
