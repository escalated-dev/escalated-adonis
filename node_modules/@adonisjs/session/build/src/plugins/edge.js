import {
  debug_default
} from "../../chunk-5ECC6OWF.js";
import "../../chunk-PZ5AY32C.js";

// src/plugins/edge.ts
var edgePluginSession = (edge) => {
  debug_default("registering session tags with edge");
  edge.registerTag({
    tagName: "flashMessage",
    seekable: true,
    block: true,
    compile(parser, buffer, token) {
      const expression = parser.utils.transformAst(
        parser.utils.generateAST(token.properties.jsArg, token.loc, token.filename),
        token.filename,
        parser
      );
      const key = parser.utils.stringify(expression);
      buffer.writeStatement(
        `if (state.flashMessages.has(${key})) {`,
        token.filename,
        token.loc.start.line
      );
      buffer.writeExpression(
        `let $message = state.flashMessages.get(${key})`,
        token.filename,
        token.loc.start.line
      );
      parser.stack.defineScope();
      parser.stack.defineVariable("$message");
      token.children.forEach((child) => {
        parser.processToken(child, buffer);
      });
      parser.stack.clearScope();
      buffer.writeStatement(`}`, token.filename, token.loc.start.line);
    }
  });
  edge.registerTag({
    tagName: "inputError",
    seekable: true,
    block: true,
    compile(parser, buffer, token) {
      const expression = parser.utils.transformAst(
        parser.utils.generateAST(token.properties.jsArg, token.loc, token.filename),
        token.filename,
        parser
      );
      const key = parser.utils.stringify(expression);
      buffer.writeStatement(
        `if (!!state.flashMessages.get('inputErrorsBag', {})[${key}]) {`,
        token.filename,
        token.loc.start.line
      );
      buffer.writeExpression(
        `let $messages = state.flashMessages.get('inputErrorsBag', {})[${key}]`,
        token.filename,
        token.loc.start.line
      );
      parser.stack.defineScope();
      parser.stack.defineVariable("$messages");
      token.children.forEach((child) => {
        parser.processToken(child, buffer);
      });
      parser.stack.clearScope();
      buffer.writeStatement(`}`, token.filename, token.loc.start.line);
    }
  });
  edge.registerTag({
    tagName: "error",
    seekable: true,
    block: true,
    compile(parser, buffer, token) {
      const expression = parser.utils.transformAst(
        parser.utils.generateAST(token.properties.jsArg, token.loc, token.filename),
        token.filename,
        parser
      );
      const key = parser.utils.stringify(expression);
      buffer.writeStatement(
        `if (state.flashMessages.has(['errorsBag', ${key}])) {`,
        token.filename,
        token.loc.start.line
      );
      buffer.writeExpression(
        `let $message = state.flashMessages.get(['errorsBag', ${key}])`,
        token.filename,
        token.loc.start.line
      );
      parser.stack.defineScope();
      parser.stack.defineVariable("$message");
      token.children.forEach((child) => {
        parser.processToken(child, buffer);
      });
      parser.stack.clearScope();
      buffer.writeStatement(`}`, token.filename, token.loc.start.line);
    }
  });
  edge.registerTag({
    tagName: "errors",
    seekable: true,
    block: true,
    compile(parser, buffer, token) {
      buffer.writeStatement(
        `if (state.flashMessages.has('errorsBag')) {`,
        token.filename,
        token.loc.start.line
      );
      buffer.writeExpression(
        `let $messages = state.flashMessages.get('errorsBag')`,
        token.filename,
        token.loc.start.line
      );
      parser.stack.defineScope();
      parser.stack.defineVariable("$messages");
      token.children.forEach((child) => {
        parser.processToken(child, buffer);
      });
      parser.stack.clearScope();
      buffer.writeStatement(`}`, token.filename, token.loc.start.line);
    }
  });
};
export {
  edgePluginSession
};
//# sourceMappingURL=edge.js.map