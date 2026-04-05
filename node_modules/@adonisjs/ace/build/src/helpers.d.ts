import type { AbstractBaseCommand, CommandMetaData, UIPrimitives } from './types.ts';
/**
 * Helper to sort array of strings alphabetically.
 */
export declare function sortAlphabetically(prev: string, curr: string): 0 | 1 | -1;
/**
 * Renders an error message and lists suggestions.
 */
export declare function renderErrorWithSuggestions(ui: UIPrimitives, message: string, suggestions: string[]): void;
/**
 * Validates the metadata of a command to ensure it has all the neccessary
 * properties
 */
export declare function validateCommandMetaData(command: unknown, exportPath: string): asserts command is CommandMetaData;
/**
 * Validates the command class. We do not check it against the "BaseCommand"
 * class, because the ace version mis-match could make the validation
 * fail.
 */
export declare function validateCommand<Command extends AbstractBaseCommand>(command: unknown, exportPath: string): asserts command is Command;
