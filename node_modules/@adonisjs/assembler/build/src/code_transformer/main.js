// src/code_transformer/main.ts
import { join } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { installPackage, detectPackageManager } from "@antfu/install-pkg";
import {
  Node as Node2,
  Project as Project2,
  QuoteKind,
  SyntaxKind as SyntaxKind2
} from "ts-morph";

// src/code_transformer/rc_file_transformer.ts
import { fileURLToPath } from "node:url";
import {
  Node,
  SyntaxKind
} from "ts-morph";
var RcFileTransformer = class {
  #cwd;
  #project;
  /**
   * Settings to use when persisting files
   */
  #editorSettings = {
    indentSize: 2,
    convertTabsToSpaces: true,
    trimTrailingWhitespace: true,
    ensureNewLineAtEndOfFile: true,
    indentStyle: 2,
    // @ts-expect-error SemicolonPreference doesn't seem to be re-exported from ts-morph
    semicolons: "remove"
  };
  constructor(cwd, project) {
    this.#cwd = cwd;
    this.#project = project;
  }
  /**
   * Get the `adonisrc.ts` source file
   */
  #getRcFileOrThrow() {
    const kernelUrl = fileURLToPath(new URL("./adonisrc.ts", this.#cwd));
    return this.#project.getSourceFileOrThrow(kernelUrl);
  }
  /**
   * Check if environments array has a subset of available environments
   */
  #isInSpecificEnvironment(environments) {
    if (!environments) {
      return false;
    }
    return !!["web", "console", "test", "repl"].find(
      (env) => !environments.includes(env)
    );
  }
  /**
   * Locate the `defineConfig` call inside the `adonisrc.ts` file
   */
  #locateDefineConfigCallOrThrow(file) {
    const call = file.getDescendantsOfKind(SyntaxKind.CallExpression).find((statement) => statement.getExpression().getText() === "defineConfig");
    if (!call) {
      throw new Error("Could not locate the defineConfig call.");
    }
    return call;
  }
  /**
   * Return the ObjectLiteralExpression of the defineConfig call
   */
  #getDefineConfigObjectOrThrow(defineConfigCall) {
    const configObject = defineConfigCall.getArguments()[0].asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    return configObject;
  }
  /**
   * Check if the defineConfig() call has the property assignment
   * inside it or not. If not, it will create one and return it.
   */
  #getPropertyAssignmentInDefineConfigCall(propertyName, initializer) {
    const file = this.#getRcFileOrThrow();
    const defineConfigCall = this.#locateDefineConfigCallOrThrow(file);
    const configObject = this.#getDefineConfigObjectOrThrow(defineConfigCall);
    let property = configObject.getProperty(propertyName);
    if (!property) {
      configObject.addPropertyAssignment({ name: propertyName, initializer });
      property = configObject.getProperty(propertyName);
    }
    return property;
  }
  /**
   * Extract list of imported modules from an ArrayLiteralExpression
   *
   * It assumes that the array can have two types of elements:
   *
   * - Simple lazy imported modules: [() => import('path/to/file')]
   * - Or an object entry: [{ file: () => import('path/to/file'), environment: ['web', 'console'] }]
   *   where the `file` property is a lazy imported module.
   */
  #extractModulesFromArray(array) {
    const modules = array.getElements().map((element) => {
      if (Node.isArrowFunction(element)) {
        const importExp = element.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
        const literal = importExp.getFirstDescendantByKindOrThrow(SyntaxKind.StringLiteral);
        return literal.getLiteralValue();
      }
      if (Node.isObjectLiteralExpression(element)) {
        const fileProp = element.getPropertyOrThrow("file");
        const arrowFn = fileProp.getFirstDescendantByKindOrThrow(SyntaxKind.ArrowFunction);
        const importExp = arrowFn.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
        const literal = importExp.getFirstDescendantByKindOrThrow(SyntaxKind.StringLiteral);
        return literal.getLiteralValue();
      }
    });
    return modules.filter(Boolean);
  }
  /**
   * Extract a specific property from an ArrayLiteralExpression
   * that contains object entries.
   *
   * This function is mainly used for extractring the `pattern` property
   * when adding a new meta files entry, or the `name` property when
   * adding a new test suite.
   */
  #extractPropertyFromArray(array, propertyName) {
    const property = array.getElements().map((el) => {
      if (!Node.isObjectLiteralExpression(el)) return;
      const nameProp = el.getPropertyOrThrow(propertyName);
      if (!Node.isPropertyAssignment(nameProp)) return;
      const name = nameProp.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral);
      return name.getLiteralValue();
    });
    return property.filter(Boolean);
  }
  /**
   * Build a new module entry for the preloads and providers array
   * based upon the environments specified
   */
  #buildNewModuleEntry(modulePath, environments) {
    if (!this.#isInSpecificEnvironment(environments)) {
      return `() => import('${modulePath}')`;
    }
    return `{
      file: () => import('${modulePath}'),
      environment: [${environments?.map((env) => `'${env}'`).join(", ")}],
    }`;
  }
  /**
   * Add a new command to the rcFile
   */
  addCommand(commandPath) {
    const commandsProperty = this.#getPropertyAssignmentInDefineConfigCall("commands", "[]");
    const commandsArray = commandsProperty.getInitializerIfKindOrThrow(
      SyntaxKind.ArrayLiteralExpression
    );
    const commandString = `() => import('${commandPath}')`;
    if (commandsArray.getElements().some((el) => el.getText() === commandString)) {
      return this;
    }
    commandsArray.addElement(commandString);
    return this;
  }
  /**
   * Add a new preloaded file to the rcFile
   */
  addPreloadFile(modulePath, environments) {
    const preloadsProperty = this.#getPropertyAssignmentInDefineConfigCall("preloads", "[]");
    const preloadsArray = preloadsProperty.getInitializerIfKindOrThrow(
      SyntaxKind.ArrayLiteralExpression
    );
    const existingPreloadedFiles = this.#extractModulesFromArray(preloadsArray);
    const isDuplicate = existingPreloadedFiles.includes(modulePath);
    if (isDuplicate) {
      return this;
    }
    preloadsArray.addElement(this.#buildNewModuleEntry(modulePath, environments));
    return this;
  }
  /**
   * Add a new provider to the rcFile
   */
  addProvider(providerPath, environments) {
    const property = this.#getPropertyAssignmentInDefineConfigCall("providers", "[]");
    const providersArray = property.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    const existingProviderPaths = this.#extractModulesFromArray(providersArray);
    const isDuplicate = existingProviderPaths.includes(providerPath);
    if (isDuplicate) {
      return this;
    }
    providersArray.addElement(this.#buildNewModuleEntry(providerPath, environments));
    return this;
  }
  /**
   * Add a new meta file to the rcFile
   */
  addMetaFile(globPattern, reloadServer = false) {
    const property = this.#getPropertyAssignmentInDefineConfigCall("metaFiles", "[]");
    const metaFilesArray = property.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    const alreadyDefinedPatterns = this.#extractPropertyFromArray(metaFilesArray, "pattern");
    if (alreadyDefinedPatterns.includes(globPattern)) {
      return this;
    }
    metaFilesArray.addElement(
      `{
        pattern: '${globPattern}',
        reloadServer: ${reloadServer},
      }`
    );
    return this;
  }
  /**
   * Set directory name and path
   */
  setDirectory(key, value) {
    const property = this.#getPropertyAssignmentInDefineConfigCall("directories", "{}");
    const directories = property.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    directories.addPropertyAssignment({ name: key, initializer: `'${value}'` });
    return this;
  }
  /**
   * Set command alias
   */
  setCommandAlias(alias, command) {
    const aliasProperty = this.#getPropertyAssignmentInDefineConfigCall("commandsAliases", "{}");
    const aliases = aliasProperty.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    aliases.addPropertyAssignment({ name: alias, initializer: `'${command}'` });
    return this;
  }
  /**
   * Add a new test suite to the rcFile
   */
  addSuite(suiteName, files, timeout) {
    const testProperty = this.#getPropertyAssignmentInDefineConfigCall(
      "tests",
      `{ suites: [], forceExit: true, timeout: 2000 }`
    );
    const property = testProperty.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression).getPropertyOrThrow("suites");
    const suitesArray = property.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    const existingSuitesNames = this.#extractPropertyFromArray(suitesArray, "name");
    if (existingSuitesNames.includes(suiteName)) {
      return this;
    }
    const filesArray = Array.isArray(files) ? files : [files];
    suitesArray.addElement(
      `{
        name: '${suiteName}',
        files: [${filesArray.map((file) => `'${file}'`).join(", ")}],
        timeout: ${timeout ?? 2e3},
      }`
    );
    return this;
  }
  /**
   * Add a new assembler hook
   */
  addAssemblerHook(type, path) {
    const hooksProperty = this.#getPropertyAssignmentInDefineConfigCall("hooks", "{}");
    const hooks = hooksProperty.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    let hookArray = hooks.getProperty(type);
    if (!hookArray) {
      hooks.addPropertyAssignment({ name: type, initializer: "[]" });
      hookArray = hooks.getProperty(type);
    }
    const hooksArray = hookArray.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    const existingHooks = this.#extractModulesFromArray(hooksArray);
    if (existingHooks.includes(path)) {
      return this;
    }
    hooksArray.addElement(`() => import('${path}')`);
    return this;
  }
  /**
   * Save the adonisrc.ts file
   */
  save() {
    const file = this.#getRcFileOrThrow();
    file.formatText(this.#editorSettings);
    return file.save();
  }
};

// src/code_transformer/main.ts
var CodeTransformer = class {
  /**
   * Exporting utilities to install package and detect
   * the package manager
   */
  installPackage = installPackage;
  detectPackageManager = detectPackageManager;
  /**
   * Directory of the adonisjs project
   */
  #cwd;
  /**
   * The TsMorph project
   */
  project;
  /**
   * Settings to use when persisting files
   */
  #editorSettings = {
    indentSize: 2,
    convertTabsToSpaces: true,
    trimTrailingWhitespace: true,
    ensureNewLineAtEndOfFile: true,
    indentStyle: 2,
    // @ts-expect-error SemicolonPreference doesn't seem to be re-exported from ts-morph
    semicolons: "remove"
  };
  constructor(cwd) {
    this.#cwd = cwd;
    this.project = new Project2({
      tsConfigFilePath: join(fileURLToPath2(this.#cwd), "tsconfig.json"),
      manipulationSettings: { quoteKind: QuoteKind.Single }
    });
  }
  /**
   * Add a new middleware to the middleware array of the
   * given file
   */
  #addToMiddlewareArray(file, target, middlewareEntry) {
    const callExpressions = file.getDescendantsOfKind(SyntaxKind2.CallExpression).filter((statement) => statement.getExpression().getText() === target);
    if (!callExpressions.length) {
      throw new Error(`Cannot find ${target} statement in the file.`);
    }
    const arrayLiteralExpression = callExpressions[0].getArguments()[0];
    if (!arrayLiteralExpression || !Node2.isArrayLiteralExpression(arrayLiteralExpression)) {
      throw new Error(`Cannot find middleware array in ${target} statement.`);
    }
    const middleware = `() => import('${middlewareEntry.path}')`;
    const existingMiddlewareIndex = arrayLiteralExpression.getElements().findIndex((element) => element.getText() === middleware);
    if (existingMiddlewareIndex === -1) {
      if (middlewareEntry.position === "before") {
        arrayLiteralExpression.insertElement(0, middleware);
      } else {
        arrayLiteralExpression.addElement(middleware);
      }
    }
  }
  /**
   * Add a new middleware to the named middleware of the given file
   */
  #addToNamedMiddleware(file, middlewareEntry) {
    if (!middlewareEntry.name) {
      throw new Error("Named middleware requires a name.");
    }
    const callArguments = file.getVariableDeclarationOrThrow("middleware").getInitializerIfKindOrThrow(SyntaxKind2.CallExpression).getArguments();
    if (callArguments.length === 0) {
      throw new Error("Named middleware call has no arguments.");
    }
    const namedMiddlewareObject = callArguments[0];
    if (!Node2.isObjectLiteralExpression(namedMiddlewareObject)) {
      throw new Error("The argument of the named middleware call is not an object literal.");
    }
    const existingProperty = namedMiddlewareObject.getProperty(middlewareEntry.name);
    if (!existingProperty) {
      const middleware = `${middlewareEntry.name}: () => import('${middlewareEntry.path}')`;
      namedMiddlewareObject.insertProperty(0, middleware);
    }
  }
  /**
   * Add a policy to the list of pre-registered policy
   */
  #addToPoliciesList(file, policyEntry) {
    const policiesObject = file.getVariableDeclarationOrThrow("policies").getInitializerIfKindOrThrow(SyntaxKind2.ObjectLiteralExpression);
    const existingProperty = policiesObject.getProperty(policyEntry.name);
    if (!existingProperty) {
      const policy = `${policyEntry.name}: () => import('${policyEntry.path}')`;
      policiesObject.insertProperty(0, policy);
    }
  }
  /**
   * Add the given import declarations to the source file
   * and merge named imports with the existing import
   */
  #addImportDeclarations(file, importDeclarations) {
    const existingImports = file.getImportDeclarations();
    importDeclarations.forEach((importDeclaration) => {
      const existingImport = existingImports.find(
        (mod) => mod.getModuleSpecifierValue() === importDeclaration.module
      );
      if (existingImport && importDeclaration.isNamed) {
        if (!existingImport.getNamedImports().find((namedImport) => namedImport.getName() === importDeclaration.identifier)) {
          existingImport.addNamedImport(importDeclaration.identifier);
        }
        return;
      }
      if (existingImport) {
        return;
      }
      file.addImportDeclaration({
        ...importDeclaration.isNamed ? { namedImports: [importDeclaration.identifier] } : { defaultImport: importDeclaration.identifier },
        moduleSpecifier: importDeclaration.module
      });
    });
  }
  /**
   * Write a leading comment
   */
  #addLeadingComment(writer, comment) {
    if (!comment) {
      return writer.blankLine();
    }
    return writer.blankLine().writeLine("/*").writeLine(`|----------------------------------------------------------`).writeLine(`| ${comment}`).writeLine(`|----------------------------------------------------------`).writeLine(`*/`);
  }
  /**
   * Add new env variable validation in the
   * `env.ts` file
   */
  async defineEnvValidations(definition) {
    const kernelUrl = fileURLToPath2(new URL("./start/env.ts", this.#cwd));
    const file = this.project.getSourceFileOrThrow(kernelUrl);
    const callExpressions = file.getDescendantsOfKind(SyntaxKind2.CallExpression).filter((statement) => statement.getExpression().getText() === "Env.create");
    if (!callExpressions.length) {
      throw new Error(`Cannot find Env.create statement in the file.`);
    }
    const objectLiteralExpression = callExpressions[0].getArguments()[1];
    if (!Node2.isObjectLiteralExpression(objectLiteralExpression)) {
      throw new Error(`The second argument of Env.create is not an object literal.`);
    }
    let shouldAddComment = true;
    for (const [variable, validation] of Object.entries(definition.variables)) {
      const existingProperty = objectLiteralExpression.getProperty(variable);
      if (existingProperty) {
        shouldAddComment = false;
      }
      if (!existingProperty) {
        objectLiteralExpression.addPropertyAssignment({
          name: variable,
          initializer: validation,
          leadingTrivia: (writer) => {
            if (!shouldAddComment) {
              return;
            }
            shouldAddComment = false;
            return this.#addLeadingComment(writer, definition.leadingComment);
          }
        });
      }
    }
    file.formatText(this.#editorSettings);
    await file.save();
  }
  /**
   * Define new middlewares inside the `start/kernel.ts`
   * file
   *
   * This function is highly based on some assumptions
   * and will not work if you significantly tweaked
   * your `start/kernel.ts` file.
   */
  async addMiddlewareToStack(stack, middleware) {
    const kernelUrl = fileURLToPath2(new URL("./start/kernel.ts", this.#cwd));
    const file = this.project.getSourceFileOrThrow(kernelUrl);
    for (const middlewareEntry of middleware) {
      if (stack === "named") {
        this.#addToNamedMiddleware(file, middlewareEntry);
      } else {
        this.#addToMiddlewareArray(file, `${stack}.use`, middlewareEntry);
      }
    }
    file.formatText(this.#editorSettings);
    await file.save();
  }
  /**
   * Update the `adonisrc.ts` file
   */
  async updateRcFile(callback) {
    const rcFileTransformer = new RcFileTransformer(this.#cwd, this.project);
    callback(rcFileTransformer);
    await rcFileTransformer.save();
  }
  /**
   * Add a new Japa plugin in the `tests/bootstrap.ts` file
   */
  async addJapaPlugin(pluginCall, importDeclarations) {
    const testBootstrapUrl = fileURLToPath2(new URL("./tests/bootstrap.ts", this.#cwd));
    const file = this.project.getSourceFileOrThrow(testBootstrapUrl);
    this.#addImportDeclarations(file, importDeclarations);
    const pluginsArray = file.getVariableDeclaration("plugins")?.getInitializerIfKind(SyntaxKind2.ArrayLiteralExpression);
    if (pluginsArray) {
      if (!pluginsArray.getElements().find((element) => element.getText() === pluginCall)) {
        pluginsArray.addElement(pluginCall);
      }
    }
    file.formatText(this.#editorSettings);
    await file.save();
  }
  /**
   * Add a new Vite plugin
   */
  async addVitePlugin(pluginCall, importDeclarations) {
    const viteConfigTsUrl = fileURLToPath2(new URL("./vite.config.ts", this.#cwd));
    const file = this.project.getSourceFile(viteConfigTsUrl);
    if (!file) {
      throw new Error(
        "Cannot find vite.config.ts file. Make sure to rename vite.config.js to vite.config.ts"
      );
    }
    this.#addImportDeclarations(file, importDeclarations);
    const defaultExport = file.getDefaultExportSymbol();
    if (!defaultExport) {
      throw new Error("Cannot find the default export in vite.config.ts");
    }
    const declaration = defaultExport.getDeclarations()[0];
    const options = declaration.getChildrenOfKind(SyntaxKind2.ObjectLiteralExpression)[0] || declaration.getChildrenOfKind(SyntaxKind2.CallExpression)[0].getArguments()[0];
    const pluginsArray = options.getPropertyOrThrow("plugins").getFirstChildByKindOrThrow(SyntaxKind2.ArrayLiteralExpression);
    if (!pluginsArray.getElements().find((element) => element.getText() === pluginCall)) {
      pluginsArray.addElement(pluginCall);
    }
    file.formatText(this.#editorSettings);
    await file.save();
  }
  /**
   * Adds a policy to the list of `policies` object configured
   * inside the `app/policies/main.ts` file.
   */
  async addPolicies(policies) {
    const kernelUrl = fileURLToPath2(new URL("./app/policies/main.ts", this.#cwd));
    const file = this.project.getSourceFileOrThrow(kernelUrl);
    for (const policy of policies) {
      this.#addToPoliciesList(file, policy);
    }
    file.formatText(this.#editorSettings);
    await file.save();
  }
};
export {
  CodeTransformer
};
//# sourceMappingURL=main.js.map