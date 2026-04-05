import {
  stubsRoot
} from "../chunk-V3OAEXMJ.js";
import "../chunk-PZ5AY32C.js";

// commands/make_session_table.ts
import { BaseCommand } from "@adonisjs/core/ace";
var MakeSessionTable = class extends BaseCommand {
  static commandName = "make:session-table";
  static description = "Create a migration for the sessions database table";
  async run() {
    const codemods = await this.createCodemods();
    await codemods.makeUsingStub(stubsRoot, "make/migration/sessions.stub", {
      migration: { tableName: "sessions", prefix: Date.now() }
    });
  }
};
export {
  MakeSessionTable as default
};
//# sourceMappingURL=make_session_table.js.map