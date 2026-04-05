import { CommandOptions } from '../../types/ace.js';
import { BaseCommand } from '../../modules/ace/main.js';
declare const ALLOWED_TYPES: readonly ["string", "boolean", "number", "enum"];
type AllowedTypes = (typeof ALLOWED_TYPES)[number];
/**
 * The env:add command is used to add a new environment variable to the
 * `.env`, `.env.example` and `start/env.ts` files.
 */
export default class EnvAdd extends BaseCommand {
    #private;
    static commandName: string;
    static description: string;
    static options: CommandOptions;
    name: string;
    value: string;
    type: AllowedTypes;
    enumValues: string[];
    run(): Promise<void>;
}
export {};
