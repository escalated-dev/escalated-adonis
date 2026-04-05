// src/auth/main.ts
import { joinToURL } from "@poppinss/utils";
var STUBS_ROOT = joinToURL(import.meta.url, "./stubs");
var GUARDS = {
  session: {
    name: "Session",
    description: "Authenticate users using cookies and session"
  },
  access_tokens: {
    name: "Access Token",
    description: "Authenticate clients using API tokens"
  },
  basic_auth: {
    name: "Basic Auth",
    description: "Authenticate users using HTTP Basic Auth"
  }
};
async function presetAuth(codemods, app, options) {
  const configStub = `config/${options.guard}_with_${options.userProvider}.stub`;
  const modelStub = `make/model/user_with_${options.guard}.stub`;
  await codemods.makeUsingStub(STUBS_ROOT, configStub, {});
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider("@adonisjs/auth/auth_provider");
  });
  await codemods.makeUsingStub(STUBS_ROOT, "make/migration/users.stub", {
    entity: app.generators.createEntity("users"),
    migration: {
      folder: "database/migrations",
      fileName: `${(/* @__PURE__ */ new Date()).getTime()}_create_users_table.ts`
    }
  });
  if (options.guard === "access_tokens") {
    await codemods.makeUsingStub(STUBS_ROOT, "make/migration/access_tokens.stub", {
      entity: app.generators.createEntity("access_tokens"),
      migration: {
        folder: "database/migrations",
        fileName: `${(/* @__PURE__ */ new Date()).getTime()}_create_access_tokens_table.ts`
      }
    });
  }
  await codemods.makeUsingStub(STUBS_ROOT, modelStub, {
    entity: app.generators.createEntity("users")
  });
  await codemods.makeUsingStub(STUBS_ROOT, "make/middleware/auth.stub", {
    entity: app.generators.createEntity("auth")
  });
  if (options.guard === "session") {
    await codemods.makeUsingStub(STUBS_ROOT, "make/middleware/guest.stub", {
      entity: app.generators.createEntity("guest")
    });
    await codemods.makeUsingStub(STUBS_ROOT, "make/middleware/silent_auth.stub", {
      entity: app.generators.createEntity("silent_auth")
    });
  }
  await codemods.registerMiddleware("router", [
    {
      path: "@adonisjs/auth/initialize_auth_middleware"
    }
  ]);
  await codemods.registerMiddleware("named", [
    {
      name: "auth",
      path: "#middleware/auth_middleware"
    },
    ...options.guard === "session" ? [
      {
        name: "guest",
        path: "#middleware/guest_middleware"
      }
    ] : []
  ]);
}
export {
  GUARDS,
  presetAuth
};
//# sourceMappingURL=main.js.map