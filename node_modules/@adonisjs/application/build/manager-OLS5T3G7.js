import {
  debug_default
} from "./chunk-OVQD25FW.js";

// src/stubs/manager.ts
import { join as join2 } from "path";
import { cp } from "fs/promises";
import { RuntimeException as RuntimeException2, fsReadAll } from "@poppinss/utils";

// src/stubs/stub.ts
import * as tempura from "tempura";
import string from "@poppinss/utils/string";
import { dirname, isAbsolute } from "path";
import { RuntimeException } from "@poppinss/utils";
import { mkdir, writeFile } from "fs/promises";
import stringHelpers from "@poppinss/utils/string";
import StringBuilder from "@poppinss/utils/string_builder";

// src/helpers.ts
import { join } from "path";
import { access, readFile } from "fs/promises";
async function readFileFromSources(fileName, sources) {
  for (let source of sources) {
    const filePath = join(source, fileName);
    const contents = await readFileOptional(filePath);
    if (contents !== null) {
      return {
        contents,
        filePath,
        fileName,
        source
      };
    }
  }
  return null;
}
async function readFileOptional(filePath) {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return null;
  }
}
async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
function parseStubExports(contents) {
  const chunks = contents.split(/\r\n|\n/);
  const body = [];
  const exportedBlocks = [];
  chunks.forEach((line) => {
    if (line.includes("<!--EXPORT_START-->")) {
      let [inital, rest] = line.split("<!--EXPORT_START-->");
      let [exports, remaining] = rest.split("<!--EXPORT_END-->");
      inital = inital.trim();
      remaining = remaining.trim();
      const remainingContents = inital && remaining ? `${inital}
${remaining}` : inital || remaining || "";
      exportedBlocks.push(exports);
      if (remainingContents) {
        body.push(remainingContents);
      }
    } else {
      body.push(line);
    }
  });
  const attributes = exportedBlocks.reduce(
    (result, block) => {
      Object.assign(result, JSON.parse(block));
      return result;
    },
    {}
  );
  return { attributes, body: body.join("\n") };
}

// src/stubs/stub.ts
function stubStringBuilder(value) {
  return new StringBuilder(value);
}
Object.assign(stubStringBuilder, stringHelpers);
var Stub = class {
  /**
   * The absolute path to the stub file. Need it for reporting
   * errors
   */
  #stubPath;
  /**
   * The contents of the stub to process
   */
  #stubContents;
  /**
   * Application class reference
   */
  #app;
  constructor(app, stubContents, stubPath) {
    this.#app = app;
    this.#stubPath = stubPath;
    this.#stubContents = stubContents;
  }
  /**
   * Patch error stack and point it to the stub file
   */
  #patchErrorStack(error) {
    const stack = error.stack.split("\n");
    stack.splice(1, 0, `    at anonymous (${this.#stubPath}:0:0)`);
    error.stack = stack.join("\n");
  }
  /**
   * Patch tempura error stack and point it to the stub file
   */
  #patchTempuraStack(error) {
    const stack = error.stack.split("\n");
    const templateErrorLine = stack[1].match(/<anonymous>:(\d+):\d+\)$/);
    if (!templateErrorLine) {
      stack.splice(1, 0, `    at anonymous (${this.#stubPath}:0:0)`);
    } else {
      stack.splice(1, 0, `    at anonymous (${this.#stubPath}:${templateErrorLine[1]}:0)`);
    }
    error.stack = stack.join("\n");
  }
  /**
   * Validates the "to" attribute
   */
  #validateToAttribute(attributes) {
    if (!attributes.to) {
      const error = new RuntimeException(`Missing "to" attribute in stub exports`);
      throw error;
    }
    if (!isAbsolute(attributes.to)) {
      const error = new RuntimeException(
        `The value for "to" attribute must be an absolute file path`
      );
      throw error;
    }
  }
  /**
   * Returns the default state for the stub
   */
  #getStubDefaults() {
    return {
      app: this.#app,
      randomString: string.random,
      generators: this.#app.generators,
      exports: (value) => {
        return `<!--EXPORT_START-->${JSON.stringify(value)}<!--EXPORT_END-->`;
      },
      string: stubStringBuilder
    };
  }
  /**
   * Renders stub using tempura templating syntax.
   */
  async #renderStub(data) {
    try {
      const render = tempura.compile(this.#stubContents, {
        props: Object.keys(data)
      });
      return render(data).trim();
    } catch (error) {
      this.#patchTempuraStack(error);
      throw error;
    }
  }
  /**
   * Parsers the stub exports
   */
  #parseExports(stubOutput) {
    try {
      const { body, attributes } = parseStubExports(stubOutput);
      this.#validateToAttribute(attributes);
      return { attributes, body };
    } catch (error) {
      this.#patchErrorStack(error);
      throw error;
    }
  }
  /**
   * Prepare stub to be written to the disk
   */
  async prepare(stubData) {
    const data = {
      ...this.#getStubDefaults(),
      ...stubData
    };
    const { attributes, body } = this.#parseExports(await this.#renderStub(data));
    debug_default("prepared stub %s", body);
    debug_default("stub attributes %O", attributes);
    return {
      contents: body,
      destination: attributes.to,
      force: stubData.force !== void 0 ? stubData.force : !!attributes.force,
      attributes
    };
  }
  /**
   * Generate resource for the stub. Writes file to the disk
   */
  async generate(stubData) {
    const { force, ...stub } = await this.prepare(stubData);
    const hasFile = await pathExists(stub.destination);
    const directory = dirname(stub.destination);
    if (!hasFile) {
      debug_default("writing file to %s", stub.destination);
      await mkdir(directory, { recursive: true });
      await writeFile(stub.destination, stub.contents);
      return {
        status: "created",
        skipReason: null,
        ...stub
      };
    }
    if (hasFile && force) {
      debug_default("overwriting file to %s", stub.destination);
      await mkdir(directory, { recursive: true });
      await writeFile(stub.destination, stub.contents);
      return {
        status: "force_created",
        skipReason: null,
        ...stub
      };
    }
    return {
      status: "skipped",
      skipReason: "File already exists",
      ...stub
    };
  }
};

// src/stubs/manager.ts
var StubsManager = class {
  #app;
  /**
   * Absolute path to the directory where stubs should
   * be published or read from with priority
   */
  #publishTarget;
  constructor(app, publishTarget) {
    this.#app = app;
    this.#publishTarget = publishTarget;
  }
  /**
   * Returns the path to the stubs source directory of a package
   */
  async #getPackageSource(packageName) {
    const pkgMainExports = await this.#app.import(packageName);
    if (!pkgMainExports.stubsRoot) {
      throw new RuntimeException2(
        `Cannot resolve stubs from package "${packageName}". Make sure the package entrypoint exports "stubsRoot" variable`
      );
    }
    return pkgMainExports.stubsRoot;
  }
  /**
   * Creates an instance of stub by its name. The lookup is performed inside
   * the publishTarget and the optional source or pkg destination.
   */
  async build(stubName, options) {
    const sources = [this.#publishTarget];
    if (options?.source) {
      sources.push(options.source);
    }
    if (options?.pkg) {
      sources.push(await this.#getPackageSource(options.pkg));
    }
    debug_default('finding stub "%s" in sources "%O"', stubName, sources);
    const file = await readFileFromSources(stubName, sources);
    if (!file) {
      throw new RuntimeException2(`Unable to find stub "${stubName}"`, {
        cause: `Scanned locations: 
${sources.join("\n")}`
      });
    }
    debug_default('building stub "%s"', file.filePath);
    return new Stub(this.#app, file.contents, file.filePath);
  }
  /**
   * Copy one or more stub files from a custom location to publish
   * target.
   */
  async copy(stubPath, options) {
    const filesCopied = [];
    const copyOptions = {
      recursive: true,
      force: options.overwrite === true ? true : false
    };
    const source = "source" in options ? join2(options.source, stubPath) : join2(await this.#getPackageSource(options.pkg), stubPath);
    try {
      const files = await fsReadAll(source, {
        filter: (path) => path === "" || path.endsWith(".stub")
      });
      debug_default('copying stubs from "%s" with options %O', source, copyOptions);
      debug_default('preparing to copy stubs "%s"', files);
      for (let filePath of files) {
        const sourcePath = join2(source, filePath);
        const destinationPath = join2(this.#publishTarget, stubPath, filePath);
        await cp(sourcePath, destinationPath, copyOptions);
        filesCopied.push(destinationPath);
      }
      return filesCopied;
    } catch (error) {
      if (error.code === "ENOENT") {
        const readingSource = "source" in options ? options.source : options.pkg;
        throw new Error(`Cannot find "${stubPath}" stub in "${readingSource}" destination`);
      }
      throw error;
    }
  }
};
export {
  StubsManager
};
