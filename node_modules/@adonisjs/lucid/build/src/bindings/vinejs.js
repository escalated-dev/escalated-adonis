/*
 * @adonisjs/lucid
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import vine, { VineNumber, VineString } from '@vinejs/vine';
/**
 * Default validation messages used by the unique and the
 * exists rules
 */
export const messages = {
    'database.unique': 'The {{ field }} has already been taken',
    'database.exists': 'The selected {{ field }} is invalid',
};
/**
 * Defines the "unique" and "exists" validation rules with
 * VineJS.
 */
export function defineValidationRules(db) {
    function uniqueRule() {
        return vine.createRule(async (value, callbackOrOptions, field) => {
            if (!field.isValid) {
                return;
            }
            /**
             * Rely on the callback to execute the query and return value
             * a boolean.
             *
             * True means value is unique
             * False means value is not unique
             */
            if (typeof callbackOrOptions === 'function') {
                const isUnique = await callbackOrOptions(db, value, field);
                if (!isUnique) {
                    field.report(messages['database.unique'], 'database.unique', field);
                }
                return;
            }
            const { table, column, filter, connection, caseInsensitive } = callbackOrOptions;
            const query = db.connection(connection).from(table).select(column);
            /**
             * Apply where clause respecting the caseInsensitive flag.
             */
            if (caseInsensitive) {
                query.whereRaw(`lower(${column}) = ?`, [db.raw(`lower(?)`, [value])]);
            }
            else {
                query.where(column, value);
            }
            /**
             * Apply user filter
             */
            await filter?.(query, value, field);
            /**
             * Fetch the first row from the database
             */
            const row = await query.first();
            if (row) {
                field.report(messages['database.unique'], 'database.unique', field);
            }
        });
    }
    function existsRule() {
        return vine.createRule(async (value, callbackOrOptions, field) => {
            if (!field.isValid) {
                return;
            }
            /**
             * Rely on the callback to execute the query and return value
             * a boolean.
             *
             * True means value exists
             * False means value does not exist
             */
            if (typeof callbackOrOptions === 'function') {
                const exists = await callbackOrOptions(db, value, field);
                if (!exists) {
                    field.report(messages['database.exists'], 'database.exists', field);
                }
                return;
            }
            const { table, column, filter, connection, caseInsensitive } = callbackOrOptions;
            const query = db.connection(connection).from(table).select(column);
            /**
             * Apply where clause respecting the caseInsensitive flag.
             */
            if (caseInsensitive) {
                query.whereRaw(`lower(${column}) = ?`, [db.raw(`lower(?)`, [value])]);
            }
            else {
                query.where(column, value);
            }
            /**
             * Apply user filter
             */
            await filter?.(query, value, field);
            /**
             * Fetch the first row from the database
             */
            const row = await query.first();
            if (!row) {
                field.report(messages['database.exists'], 'database.exists', field);
            }
        });
    }
    const uniqueRuleForString = uniqueRule();
    const uniqueRuleForNumber = uniqueRule();
    const existsRuleForString = existsRule();
    const existsRuleForNumber = existsRule();
    VineString.macro('unique', function (callbackOrOptions) {
        return this.use(uniqueRuleForString(callbackOrOptions));
    });
    VineString.macro('exists', function (callbackOrOptions) {
        return this.use(existsRuleForString(callbackOrOptions));
    });
    VineNumber.macro('unique', function (callbackOrOptions) {
        return this.use(uniqueRuleForNumber(callbackOrOptions));
    });
    VineNumber.macro('exists', function (callbackOrOptions) {
        return this.use(existsRuleForNumber(callbackOrOptions));
    });
}
