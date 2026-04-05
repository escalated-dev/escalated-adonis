import type { Database } from '../database/main.js';
/**
 * Default validation messages used by the unique and the
 * exists rules
 */
export declare const messages: {
    'database.unique': string;
    'database.exists': string;
};
/**
 * Defines the "unique" and "exists" validation rules with
 * VineJS.
 */
export declare function defineValidationRules(db: Database): void;
