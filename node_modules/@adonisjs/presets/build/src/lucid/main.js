// src/lucid/main.ts
import { mkdir } from "node:fs/promises";
import { joinToURL } from "@poppinss/utils";
var STUBS_ROOT = joinToURL(import.meta.url, "./stubs");
var DIALECTS = {
  sqlite: {
    name: "SQLite",
    pkg: ["better-sqlite3"]
  },
  libsql: {
    name: "LibSQL",
    pkg: ["@libsql/sqlite3", "sqlite3"]
  },
  mysql: {
    name: "MySQL",
    pkg: ["mysql2"],
    envVars: {
      DB_HOST: "127.0.0.1",
      DB_PORT: 3306,
      DB_USER: "root",
      DB_PASSWORD: "root",
      DB_DATABASE: "app"
    },
    envValidations: {
      DB_HOST: `Env.schema.string({ format: 'host' })`,
      DB_PORT: `Env.schema.number()`,
      DB_USER: "Env.schema.string()",
      DB_PASSWORD: "Env.schema.string.optional()",
      DB_DATABASE: "Env.schema.string()"
    }
  },
  postgres: {
    name: "PostgreSQL",
    pkg: ["pg"],
    envVars: {
      DB_HOST: "127.0.0.1",
      DB_PORT: 5432,
      DB_USER: "root",
      DB_PASSWORD: "root",
      DB_DATABASE: "app"
    },
    envValidations: {
      DB_HOST: `Env.schema.string({ format: 'host' })`,
      DB_PORT: `Env.schema.number()`,
      DB_USER: "Env.schema.string()",
      DB_PASSWORD: "Env.schema.string.optional()",
      DB_DATABASE: "Env.schema.string()"
    }
  },
  mssql: {
    name: "MS SQL",
    pkg: ["tedious"],
    envVars: {
      DB_HOST: "127.0.0.1",
      DB_PORT: 1433,
      DB_USER: "root",
      DB_PASSWORD: "root",
      DB_DATABASE: "app"
    },
    envValidations: {
      DB_HOST: `Env.schema.string({ format: 'host' })`,
      DB_PORT: `Env.schema.number()`,
      DB_USER: "Env.schema.string()",
      DB_PASSWORD: "Env.schema.string.optional()",
      DB_DATABASE: "Env.schema.string()"
    }
  }
};
async function presetLucid(codemods, app, options) {
  const { pkg, envVars, envValidations } = DIALECTS[options.dialect];
  const packagesToInstall = [
    ...pkg.map((name) => {
      return {
        name,
        isDevDependency: false
      };
    }),
    { name: "luxon", isDevDependency: false },
    { name: "@types/luxon", isDevDependency: true }
  ];
  await codemods.makeUsingStub(STUBS_ROOT, `config/database/${options.dialect}.stub`, {});
  if (["sqlite", "libsql"].includes(options.dialect)) {
    try {
      await mkdir(app.tmpPath(), { recursive: true });
    } catch {
    }
  }
  await codemods.updateRcFile((rcFile) => {
    rcFile.addCommand("@adonisjs/lucid/commands");
    rcFile.addProvider("@adonisjs/lucid/database_provider");
  });
  if (envVars) {
    await codemods.defineEnvVariables(envVars);
  }
  if (envValidations) {
    await codemods.defineEnvValidations({
      variables: envValidations,
      leadingComment: "Variables for configuring database connection"
    });
  }
  if (options.installPackages) {
    await codemods.installPackages(packagesToInstall);
  } else {
    await codemods.listPackagesToInstall(packagesToInstall);
  }
}
export {
  DIALECTS,
  presetLucid
};
//# sourceMappingURL=main.js.map