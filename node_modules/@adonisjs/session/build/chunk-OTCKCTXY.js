import {
  stubsRoot
} from "./chunk-V3OAEXMJ.js";
import {
  debug_default
} from "./chunk-5ECC6OWF.js";

// configure.ts
async function configure(command) {
  const codemods = await command.createCodemods();
  await codemods.makeUsingStub(stubsRoot, "config/session.stub", {});
  await codemods.defineEnvVariables({ SESSION_DRIVER: "cookie" });
  await codemods.defineEnvValidations({
    variables: {
      SESSION_DRIVER: `Env.schema.enum(['cookie', 'memory'] as const)`
    },
    leadingComment: "Variables for configuring session package"
  });
  await codemods.registerMiddleware("router", [
    {
      path: "@adonisjs/session/session_middleware"
    }
  ]);
  await codemods.updateRcFile((rcFile) => {
    rcFile.addProvider("@adonisjs/session/session_provider");
    rcFile.addCommand("@adonisjs/session/commands");
  });
}

// src/define_config.ts
import string from "@poppinss/utils/string";
import { configProvider } from "@adonisjs/core";
import { InvalidArgumentsException, RuntimeException } from "@poppinss/utils";

// src/stores/memory.ts
var MemoryStore = class _MemoryStore {
  static sessions = /* @__PURE__ */ new Map();
  /**
   * Maps session IDs to user IDs (for tagging)
   */
  static tags = /* @__PURE__ */ new Map();
  /**
   * Read session id value from the memory
   */
  read(sessionId) {
    return _MemoryStore.sessions.get(sessionId) || null;
  }
  /**
   * Save in memory value for a given session id
   */
  write(sessionId, values) {
    _MemoryStore.sessions.set(sessionId, values);
  }
  /**
   * Cleanup for a single session
   */
  destroy(sessionId) {
    _MemoryStore.sessions.delete(sessionId);
    _MemoryStore.tags.delete(sessionId);
  }
  touch() {
  }
  /**
   * Tag a session with a user ID
   */
  async tag(sessionId, userId) {
    _MemoryStore.tags.set(sessionId, userId);
  }
  /**
   * Get all sessions for a given user ID (tag)
   */
  async tagged(userId) {
    const sessions = [];
    for (const [sessionId, taggedUserId] of _MemoryStore.tags) {
      const data = _MemoryStore.sessions.get(sessionId);
      if (taggedUserId === userId && data) sessions.push({ id: sessionId, data });
    }
    return sessions;
  }
};

// src/define_config.ts
function defineConfig(config) {
  debug_default("processing session config %O", config);
  if (!config.store) {
    throw new InvalidArgumentsException('Missing "store" property inside the session config');
  }
  const { stores: stores2, cookie, ...rest } = {
    enabled: true,
    age: "2h",
    cookieName: "adonis_session",
    clearWithBrowser: false,
    ...config
  };
  const cookieOptions = { ...cookie };
  if (!rest.clearWithBrowser) {
    cookieOptions.maxAge = string.seconds.parse(rest.age);
    debug_default('computing maxAge "%s" for session id cookie', cookieOptions.maxAge);
  }
  return configProvider.create(async (app) => {
    const storesNames = Object.keys(config.stores);
    const storesList = {
      memory: () => new MemoryStore()
    };
    for (let storeName of storesNames) {
      const store = config.stores[storeName];
      if (typeof store === "function") {
        storesList[storeName] = store;
      } else {
        storesList[storeName] = await store.resolver(app);
      }
    }
    const transformedConfig = {
      ...rest,
      cookie: cookieOptions,
      stores: storesList
    };
    debug_default("transformed session config %O", transformedConfig);
    return transformedConfig;
  });
}
var stores = {
  file: (config) => {
    return configProvider.create(async () => {
      const { FileStore } = await import("./file-K3GBSVSU.js");
      return (_, sessionConfig) => {
        return new FileStore(config, sessionConfig.age);
      };
    });
  },
  redis: (config) => {
    return configProvider.create(async (app) => {
      const { RedisStore } = await import("./redis-YGX2CNE2.js");
      const redis = await app.container.make("redis");
      return (_, sessionConfig) => {
        return new RedisStore(redis.connection(config.connection), sessionConfig.age);
      };
    });
  },
  cookie: () => {
    return configProvider.create(async () => {
      const { CookieStore } = await import("./cookie-3C33DMWA.js");
      return (ctx, sessionConfig) => {
        return new CookieStore(sessionConfig.cookie, ctx);
      };
    });
  },
  dynamodb: (config) => {
    return configProvider.create(async () => {
      const { DynamoDBStore } = await import("./dynamodb-53YXEFIJ.js");
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const client = "clientConfig" in config ? new DynamoDBClient(config.clientConfig) : config.client;
      return (_, sessionConfig) => {
        return new DynamoDBStore(client, sessionConfig.age, {
          tableName: config.tableName,
          keyAttribute: config.keyAttribute
        });
      };
    });
  },
  database: (config) => {
    return configProvider.create(async (app) => {
      const { DatabaseStore } = await import("./database-Y33BTHTP.js");
      const db = await app.container.make("lucid.db");
      const connectionName = config?.connectionName || db.primaryConnectionName;
      if (!db.manager.has(connectionName)) {
        throw new RuntimeException(
          `Invalid database connection "${connectionName}" referenced in session config`
        );
      }
      return (_, sessionConfig) => {
        return new DatabaseStore(db.connection(connectionName), sessionConfig.age, {
          tableName: config?.tableName,
          gcProbability: config?.gcProbability
        });
      };
    });
  }
};

export {
  configure,
  defineConfig,
  stores
};
//# sourceMappingURL=chunk-OTCKCTXY.js.map