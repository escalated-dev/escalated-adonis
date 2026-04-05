import {
  HttpContext,
  Qs,
  Request,
  Response,
  Router,
  Server,
  defineConfig
} from "../chunk-OLJ72AJE.js";

// factories/http_context.ts
import { Container } from "@adonisjs/fold";
import { LoggerFactory } from "@adonisjs/logger/factories";

// factories/request.ts
import { Socket } from "net";
import proxyAddr from "proxy-addr";
import { IncomingMessage, ServerResponse } from "http";
import { EncryptionFactory } from "@adonisjs/encryption/factories";

// factories/qs_parser_factory.ts
var QsParserFactory = class {
  #options = {
    parse: {
      depth: 5,
      parameterLimit: 1e3,
      allowSparse: false,
      arrayLimit: 20,
      comma: true
    },
    stringify: {
      encode: true,
      encodeValuesOnly: false,
      arrayFormat: "indices",
      skipNulls: false
    }
  };
  /**
   * Merge encryption factory options
   */
  merge(options) {
    Object.assign(this.#options.parse, options.parse);
    Object.assign(this.#options.stringify, options.stringify);
    return this;
  }
  /**
   * Create instance of the logger class
   */
  create() {
    return new Qs(this.#options);
  }
};

// factories/request.ts
var RequestFactory = class {
  #parameters = {};
  /**
   * Returns the config for the request class
   */
  #getConfig() {
    return {
      allowMethodSpoofing: false,
      trustProxy: proxyAddr.compile("loopback"),
      subdomainOffset: 2,
      generateRequestId: false,
      ...this.#parameters.config
    };
  }
  /**
   * Returns the HTTP req object
   */
  #createRequest() {
    const req = this.#parameters.req || new IncomingMessage(new Socket());
    if (this.#parameters.url) {
      req.url = this.#parameters.url;
    }
    if (this.#parameters.method) {
      req.method = this.#parameters.method;
    }
    return req;
  }
  /**
   * Returns the HTTP res object
   */
  #createResponse(req) {
    return this.#parameters.res || new ServerResponse(req);
  }
  /**
   * Returns an instance of the encryptor to encrypt
   * signed URLs
   */
  #createEncryption() {
    return this.#parameters.encryption || new EncryptionFactory().create();
  }
  /**
   * Merge factory params
   */
  merge(params) {
    Object.assign(this.#parameters, params);
    return this;
  }
  /**
   * Create request
   */
  create() {
    const req = this.#createRequest();
    return new Request(
      req,
      this.#createResponse(req),
      this.#createEncryption(),
      this.#getConfig(),
      new QsParserFactory().create()
    );
  }
};

// factories/response.ts
import { Socket as Socket2 } from "net";
import { IncomingMessage as IncomingMessage2, ServerResponse as ServerResponse2 } from "http";
import { EncryptionFactory as EncryptionFactory3 } from "@adonisjs/encryption/factories";

// factories/router.ts
import { AppFactory } from "@adonisjs/application/factories";
import { EncryptionFactory as EncryptionFactory2 } from "@adonisjs/encryption/factories";
var RouterFactory = class {
  #parameters = {};
  /**
   * Returns an instance of the application class
   */
  #getApp() {
    return this.#parameters.app || new AppFactory().create(new URL("./app/", import.meta.url));
  }
  /**
   * Returns an instance of the encryptor to encrypt
   * signed URLs
   */
  #createEncryption() {
    return this.#parameters.encryption || new EncryptionFactory2().create();
  }
  /**
   * Merge factory params
   */
  merge(params) {
    Object.assign(this.#parameters, params);
    return this;
  }
  /**
   * Create router instance
   */
  create() {
    return new Router(this.#getApp(), this.#createEncryption(), new QsParserFactory().create());
  }
};

// factories/response.ts
var ResponseFactory = class {
  #parameters = {};
  /**
   * Returns the config for the request class
   */
  #getConfig() {
    return {
      etag: false,
      jsonpCallbackName: "callback",
      cookie: {
        maxAge: 90,
        path: "/",
        httpOnly: true,
        sameSite: false,
        secure: false
      },
      ...this.#parameters.config
    };
  }
  /**
   * Returns the HTTP req object
   */
  #createRequest() {
    return this.#parameters.req || new IncomingMessage2(new Socket2());
  }
  /**
   * Returns an instance of the router
   */
  #createRouter() {
    return this.#parameters.router || new RouterFactory().create();
  }
  /**
   * Returns the HTTP res object
   */
  #createResponse(req) {
    return this.#parameters.res || new ServerResponse2(req);
  }
  /**
   * Returns an instance of the encryptor to encrypt
   * signed URLs
   */
  #createEncryption() {
    return this.#parameters.encryption || new EncryptionFactory3().create();
  }
  /**
   * Merge factory params
   */
  merge(params) {
    Object.assign(this.#parameters, params);
    return this;
  }
  /**
   * Create response class instance
   */
  create() {
    const req = this.#createRequest();
    return new Response(
      req,
      this.#createResponse(req),
      this.#createEncryption(),
      this.#getConfig(),
      this.#createRouter(),
      new QsParserFactory().create()
    );
  }
};

// factories/http_context.ts
var HttpContextFactory = class {
  #parameters = {};
  /**
   * Returns the request class instance
   */
  #createRequest() {
    return this.#parameters.request || new RequestFactory().create();
  }
  /**
   * Returns the response class instance
   */
  #createResponse() {
    return this.#parameters.response || new ResponseFactory().create();
  }
  /**
   * Returns an instance of the logger class
   */
  #createLogger() {
    return this.#parameters.logger || new LoggerFactory().create();
  }
  /**
   * Merge factory params
   */
  merge(params) {
    Object.assign(this.#parameters, params);
    return this;
  }
  /**
   * Create request
   */
  create() {
    return new HttpContext(
      this.#createRequest(),
      this.#createResponse(),
      this.#createLogger(),
      new Container().createResolver()
    );
  }
};

// factories/server_factory.ts
import { Logger } from "@adonisjs/logger";
import { Emitter } from "@adonisjs/events";
import { AppFactory as AppFactory2 } from "@adonisjs/application/factories";
import { EncryptionFactory as EncryptionFactory4 } from "@adonisjs/encryption/factories";
var ServerFactory = class {
  #parameters = {};
  /**
   * Returns the emitter instance
   */
  #getEmitter() {
    return this.#parameters.emitter || new Emitter(this.#getApp());
  }
  /**
   * Returns the logger instance
   */
  #getLogger() {
    return this.#parameters.logger || new Logger({ enabled: false });
  }
  /**
   * Returns the config for the server class
   */
  #getConfig() {
    return defineConfig(this.#parameters.config || {});
  }
  /**
   * Returns an instance of the application class
   */
  #getApp() {
    return this.#parameters.app || new AppFactory2().create(new URL("./app/", import.meta.url));
  }
  /**
   * Returns an instance of the encryptor to encrypt
   * signed URLs
   */
  #createEncryption() {
    return this.#parameters.encryption || new EncryptionFactory4().create();
  }
  /**
   * Merge factory params
   */
  merge(params) {
    Object.assign(this.#parameters, params);
    return this;
  }
  /**
   * Create server instance
   */
  create() {
    return new Server(
      this.#getApp(),
      this.#createEncryption(),
      this.#getEmitter(),
      this.#getLogger(),
      this.#getConfig()
    );
  }
};
export {
  HttpContextFactory,
  QsParserFactory,
  RequestFactory,
  ResponseFactory,
  RouterFactory,
  ServerFactory
};
//# sourceMappingURL=main.js.map