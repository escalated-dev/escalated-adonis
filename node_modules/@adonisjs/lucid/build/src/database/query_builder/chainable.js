/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import Macroable from '@poppinss/macroable';
import { Exception } from '@poppinss/utils';
import { isObject } from '../../utils/index.js';
import { RawQueryBuilder } from './raw.js';
import { RawBuilder } from '../static_builder/raw.js';
import { ReferenceBuilder } from '../static_builder/reference.js';
/**
 * The chainable query builder to construct SQL queries for selecting, updating and
 * deleting records.
 *
 * The API internally uses the knex query builder. However, many of methods may have
 * different API.
 */
export class Chainable extends Macroable {
    knexQuery;
    queryCallback;
    keysResolver;
    hasAggregates = false;
    hasGroupBy = false;
    hasUnion = false;
    /**
     * Collection where clauses in a 2nd array. Calling `wrapExisting`
     * adds a new stack item
     */
    whereStack = [[]];
    /**
     * Returns the recent most array from the where stack
     */
    getRecentStackItem() {
        return this.whereStack[this.whereStack.length - 1];
    }
    /**
     * Returns the wrapping method for a given where method
     */
    getWrappingMethod(method) {
        if (method.startsWith('or')) {
            return {
                method: method,
                wrappingMethod: 'orWhere',
            };
        }
        return {
            method: method,
            wrappingMethod: 'where',
        };
    }
    /**
     * Applies the where clauses
     */
    applyWhere() {
        this.knexQuery.clearWhere();
        if (this.whereStack.length === 1) {
            this.whereStack[0].forEach(({ method, args }) => {
                ;
                this.knexQuery[method](...args);
            });
            return;
        }
        this.whereStack.forEach((collection) => {
            if (collection.length) {
                const firstItem = collection.shift();
                const wrapper = this.getWrappingMethod(firstItem.method);
                this.knexQuery[wrapper.wrappingMethod]((subquery) => {
                    subquery[wrapper.method](...firstItem.args);
                    collection.forEach(({ method, args }) => subquery[method](...args));
                });
            }
        });
    }
    /**
     * An array of selected columns
     */
    get columns() {
        return this.knexQuery['_statements']
            .filter(({ grouping }) => grouping === 'columns')
            .reduce((result, { value }) => {
            result = result.concat(value);
            return result;
        }, []);
    }
    /**
     * Custom alias for the query results. Ignored if it not a
     * subquery
     */
    subQueryAlias;
    constructor(knexQuery, queryCallback, keysResolver) {
        super();
        this.knexQuery = knexQuery;
        this.queryCallback = queryCallback;
        this.keysResolver = keysResolver;
    }
    /**
     * Raises exception when only one argument is passed to a where
     * clause and it is a string. It means the value is undefined
     */
    validateWhereSingleArgument(value, method) {
        if (typeof value === 'string') {
            throw new Exception(`".${method}" expects value to be defined, but undefined is passed`);
        }
    }
    /**
     * Returns the value pair for the `whereBetween` clause
     */
    getBetweenPair(value) {
        const [lhs, rhs] = value;
        if (lhs === undefined || rhs === undefined) {
            throw new Error('Invalid array for whereBetween value');
        }
        return [this.transformValue(lhs), this.transformValue(rhs)];
    }
    /**
     * Normalizes the columns aggregates functions to something
     * knex can process.
     */
    normalizeAggregateColumns(columns, alias) {
        if (columns.constructor === Object) {
            return Object.keys(columns).reduce((result, key) => {
                const value = columns[key];
                result[key] =
                    typeof value === 'string' ? this.resolveKey(value) : this.transformValue(value);
                return result;
            }, {});
        }
        if (!alias) {
            return columns;
        }
        return {
            [alias]: typeof columns === 'string' ? this.resolveKey(columns) : this.transformValue(columns),
        };
    }
    /**
     * Resolves the column name considering raw queries as well.
     */
    resolveColumn(columns, checkForObject = false, returnValue) {
        if (columns instanceof RawQueryBuilder) {
            return columns['knexQuery'];
        }
        if (columns instanceof RawBuilder) {
            return columns.toKnex(this.knexQuery.client);
        }
        return this.resolveKey(columns, checkForObject, returnValue);
    }
    /**
     * Resolves column names
     */
    resolveKey(columns, checkForObject = false, returnValue) {
        /**
         * If there is no keys resolver in place, then return the
         * optional return value or defined column(s)
         */
        if (!this.keysResolver) {
            return returnValue || columns;
        }
        /**
         * If column is a string, then resolve it as a key
         */
        if (typeof columns === 'string') {
            return columns === '*' ? columns : this.keysResolver(columns);
        }
        /**
         * If check for objects is enabled, then resolve object keys
         */
        if (checkForObject && isObject(columns)) {
            return Object.keys(columns).reduce((result, column) => {
                result[this.keysResolver(column)] = columns[column];
                return result;
            }, {});
        }
        /**
         * Return the return value or columns as fallback
         */
        return returnValue || columns;
    }
    /**
     * Apply existing query flags to a new query builder. This is
     * done during clone operation
     */
    applyQueryFlags(query) {
        query.hasAggregates = this.hasAggregates;
        query.hasGroupBy = this.hasGroupBy;
        query.hasUnion = this.hasUnion;
        query.whereStack = this.whereStack.map((collection) => {
            return collection.map((node) => node);
        });
    }
    /**
     * Transforms the value to something that knex can internally understand and
     * handle. It includes.
     *
     * 1. Returning the `knexBuilder` for sub queries.
     * 2. Returning the `knex.refBuilder` for reference builder.
     * 2. Returning the `knexBuilder` for raw queries.
     * 3. Wrapping callbacks, so that the end user receives an instance Lucid query
     *    builder and not knex query builder.
     */
    transformValue(value) {
        if (value instanceof Chainable) {
            return value.toKnex();
        }
        if (value instanceof ReferenceBuilder) {
            return value.toKnex(this.knexQuery.client);
        }
        if (typeof value === 'function') {
            return this.transformCallback(value);
        }
        return this.transformRaw(value);
    }
    /**
     * Transforms the user callback to something that knex
     * can internally process
     */
    transformCallback(value) {
        if (typeof value === 'function') {
            return this.queryCallback(value, this.keysResolver);
        }
        return value;
    }
    /**
     * Returns the underlying knex raw query builder for Lucid raw
     * query builder
     */
    transformRaw(value) {
        if (value instanceof RawQueryBuilder) {
            return value['knexQuery'];
        }
        if (value instanceof RawBuilder) {
            return value.toKnex(this.knexQuery.client);
        }
        return value;
    }
    /**
     * Define columns for selection
     */
    select(...args) {
        let columns = args;
        if (Array.isArray(args[0])) {
            columns = args[0];
        }
        this.knexQuery.select(columns.map((column) => {
            if (typeof column === 'string') {
                return this.resolveKey(column, true);
            }
            return this.transformValue(column);
        }));
        return this;
    }
    /**
     * Select table for the query. Re-calling this method multiple times will
     * use the last selected table
     */
    from(table) {
        this.knexQuery.from(this.transformValue(table));
        return this;
    }
    /**
     * Wrap existing where clauses to its own group
     */
    wrapExisting() {
        if (this.getRecentStackItem().length) {
            this.whereStack.push([]);
        }
        return this;
    }
    /**
     * Add a `where` clause
     */
    where(key, operator, value) {
        const whereClauses = this.getRecentStackItem();
        if (value !== undefined) {
            whereClauses.push({
                method: 'where',
                args: [this.resolveColumn(key), operator, this.transformValue(value)],
            });
        }
        else if (operator !== undefined) {
            whereClauses.push({
                method: 'where',
                args: [this.resolveColumn(key), this.transformValue(operator)],
            });
        }
        else {
            /**
             * Only callback is allowed as a standalone param. One must use `whereRaw`
             * for raw/sub queries. This is our limitation to have consistent API
             */
            this.validateWhereSingleArgument(key, 'where');
            whereClauses.push({
                method: 'where',
                args: [this.resolveColumn(key, true, this.transformCallback(key))],
            });
        }
        return this;
    }
    /**
     * Add a `or where` clause
     */
    orWhere(key, operator, value) {
        const whereClauses = this.getRecentStackItem();
        if (value !== undefined) {
            whereClauses.push({
                method: 'orWhere',
                args: [this.resolveColumn(key), operator, this.transformValue(value)],
            });
        }
        else if (operator !== undefined) {
            whereClauses.push({
                method: 'orWhere',
                args: [this.resolveColumn(key), this.transformValue(operator)],
            });
        }
        else {
            this.validateWhereSingleArgument(key, 'orWhere');
            whereClauses.push({
                method: 'orWhere',
                args: [this.resolveColumn(key, true, this.transformCallback(key))],
            });
        }
        return this;
    }
    /**
     * Alias for `where`
     */
    andWhere(key, operator, value) {
        return this.where(key, operator, value);
    }
    /**
     * Adding `where not` clause
     */
    whereNot(key, operator, value) {
        const whereClauses = this.getRecentStackItem();
        if (value !== undefined) {
            whereClauses.push({
                method: 'whereNot',
                args: [this.resolveColumn(key), operator, this.transformValue(value)],
            });
        }
        else if (operator !== undefined) {
            whereClauses.push({
                method: 'whereNot',
                args: [this.resolveColumn(key), this.transformValue(operator)],
            });
        }
        else {
            this.validateWhereSingleArgument(key, 'whereNot');
            whereClauses.push({
                method: 'whereNot',
                args: [this.resolveColumn(key, true, this.transformCallback(key))],
            });
        }
        return this;
    }
    /**
     * Adding `or where not` clause
     */
    orWhereNot(key, operator, value) {
        const whereClauses = this.getRecentStackItem();
        if (value !== undefined) {
            whereClauses.push({
                method: 'orWhereNot',
                args: [this.resolveColumn(key), operator, this.transformValue(value)],
            });
        }
        else if (operator !== undefined) {
            whereClauses.push({
                method: 'orWhereNot',
                args: [this.resolveColumn(key), this.transformValue(operator)],
            });
        }
        else {
            this.validateWhereSingleArgument(key, 'orWhereNot');
            whereClauses.push({
                method: 'orWhereNot',
                args: [this.resolveColumn(key, true, this.transformCallback(key))],
            });
        }
        return this;
    }
    /**
     * Alias for [[whereNot]]
     */
    andWhereNot(key, operator, value) {
        return this.whereNot(key, operator, value);
    }
    /**
     * Add a where clause on a given column
     */
    whereColumn(column, operator, comparisonColumn) {
        if (comparisonColumn !== undefined) {
            this.where(column, operator, new ReferenceBuilder(comparisonColumn, this.knexQuery.client));
        }
        else {
            this.where(column, new ReferenceBuilder(operator, this.knexQuery.client));
        }
        return this;
    }
    /**
     * Add a orWhere clause on a given column
     */
    orWhereColumn(column, operator, comparisonColumn) {
        if (comparisonColumn !== undefined) {
            this.orWhere(column, operator, new ReferenceBuilder(comparisonColumn, this.knexQuery.client));
        }
        else {
            this.orWhere(column, new ReferenceBuilder(operator, this.knexQuery.client));
        }
        return this;
    }
    /**
     * Alias for whereColumn
     */
    andWhereColumn(column, operator, comparisonColumn) {
        return this.whereColumn(column, operator, comparisonColumn);
    }
    /**
     * Add a whereNot clause on a given column
     */
    whereNotColumn(column, operator, comparisonColumn) {
        if (comparisonColumn !== undefined) {
            this.whereNot(column, operator, new ReferenceBuilder(comparisonColumn, this.knexQuery.client));
        }
        else {
            this.whereNot(column, new ReferenceBuilder(operator, this.knexQuery.client));
        }
        return this;
    }
    /**
     * Add a orWhereNotColumn clause on a given column
     */
    orWhereNotColumn(column, operator, comparisonColumn) {
        if (comparisonColumn !== undefined) {
            this.orWhereNot(column, operator, new ReferenceBuilder(comparisonColumn, this.knexQuery.client));
        }
        else {
            this.orWhereNot(column, new ReferenceBuilder(operator, this.knexQuery.client));
        }
        return this;
    }
    /**
     * Alias for whereNotColumn
     */
    andWhereNotColumn(column, operator, comparisonColumn) {
        return this.whereNotColumn(column, operator, comparisonColumn);
    }
    /**
     * Adding a `where in` clause
     */
    whereIn(columns, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        columns = Array.isArray(columns)
            ? columns.map((column) => this.resolveColumn(column))
            : this.resolveColumn(columns);
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereIn',
            args: [columns, value],
        });
        return this;
    }
    /**
     * Adding a `or where in` clause
     */
    orWhereIn(columns, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        columns = Array.isArray(columns)
            ? columns.map((column) => this.resolveColumn(column))
            : this.resolveColumn(columns);
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereIn',
            args: [columns, value],
        });
        return this;
    }
    /**
     * Alias for [[whereIn]]
     */
    andWhereIn(key, value) {
        return this.whereIn(key, value);
    }
    /**
     * Adding a `where not in` clause
     */
    whereNotIn(columns, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        columns = Array.isArray(columns)
            ? columns.map((column) => this.resolveColumn(column))
            : this.resolveColumn(columns);
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereNotIn',
            args: [columns, value],
        });
        return this;
    }
    /**
     * Adding a `or where not in` clause
     */
    orWhereNotIn(columns, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        columns = Array.isArray(columns)
            ? columns.map((column) => this.resolveColumn(column))
            : this.resolveColumn(columns);
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereNotIn',
            args: [columns, value],
        });
        return this;
    }
    /**
     * Alias for [[whereNotIn]]
     */
    andWhereNotIn(key, value) {
        return this.whereNotIn(key, value);
    }
    /**
     * Adding `where not null` clause
     */
    whereNull(key) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereNull',
            args: [this.resolveColumn(key)],
        });
        return this;
    }
    /**
     * Adding `or where not null` clause
     */
    orWhereNull(key) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereNull',
            args: [this.resolveColumn(key)],
        });
        return this;
    }
    /**
     * Alias for [[whereNull]]
     */
    andWhereNull(key) {
        return this.whereNull(key);
    }
    /**
     * Adding `where not null` clause
     */
    whereNotNull(key) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereNotNull',
            args: [this.resolveColumn(key)],
        });
        return this;
    }
    /**
     * Adding `or where not null` clause
     */
    orWhereNotNull(key) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereNotNull',
            args: [this.resolveColumn(key)],
        });
        return this;
    }
    /**
     * Alias for [[whereNotNull]]
     */
    andWhereNotNull(key) {
        return this.whereNotNull(key);
    }
    /**
     * Add a `where exists` clause
     */
    whereExists(value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereExists',
            args: [this.transformValue(value)],
        });
        return this;
    }
    /**
     * Add a `or where exists` clause
     */
    orWhereExists(value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereExists',
            args: [this.transformValue(value)],
        });
        return this;
    }
    /**
     * Alias for [[whereExists]]
     */
    andWhereExists(value) {
        return this.whereExists(value);
    }
    /**
     * Add a `where not exists` clause
     */
    whereNotExists(value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereNotExists',
            args: [this.transformValue(value)],
        });
        return this;
    }
    /**
     * Add a `or where not exists` clause
     */
    orWhereNotExists(value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereNotExists',
            args: [this.transformValue(value)],
        });
        return this;
    }
    /**
     * Alias for [[whereNotExists]]
     */
    andWhereNotExists(value) {
        return this.whereNotExists(value);
    }
    /**
     * Add where between clause
     */
    whereBetween(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereBetween',
            args: [this.resolveColumn(key), this.getBetweenPair(value)],
        });
        return this;
    }
    /**
     * Add where between clause
     */
    orWhereBetween(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereBetween',
            args: [this.resolveColumn(key), this.getBetweenPair(value)],
        });
        return this;
    }
    /**
     * Alias for [[whereBetween]]
     */
    andWhereBetween(key, value) {
        return this.whereBetween(key, value);
    }
    /**
     * Add where between clause
     */
    whereNotBetween(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereNotBetween',
            args: [this.resolveColumn(key), this.getBetweenPair(value)],
        });
        return this;
    }
    /**
     * Add where between clause
     */
    orWhereNotBetween(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereNotBetween',
            args: [this.resolveColumn(key), this.getBetweenPair(value)],
        });
        return this;
    }
    /**
     * Alias for [[whereNotBetween]]
     */
    andWhereNotBetween(key, value) {
        return this.whereNotBetween(key, value);
    }
    /**
     * Adding a where clause using raw sql
     */
    whereRaw(sql, bindings) {
        const whereClauses = this.getRecentStackItem();
        if (bindings) {
            bindings = Array.isArray(bindings)
                ? bindings.map((binding) => this.transformValue(binding))
                : bindings;
            whereClauses.push({
                method: 'whereRaw',
                args: [sql, bindings],
            });
        }
        else {
            whereClauses.push({
                method: 'whereRaw',
                args: [this.transformRaw(sql)],
            });
        }
        return this;
    }
    /**
     * Adding a or where clause using raw sql
     */
    orWhereRaw(sql, bindings) {
        const whereClauses = this.getRecentStackItem();
        if (bindings) {
            bindings = Array.isArray(bindings)
                ? bindings.map((binding) => this.transformValue(binding))
                : bindings;
            whereClauses.push({
                method: 'orWhereRaw',
                args: [sql, bindings],
            });
        }
        else {
            whereClauses.push({
                method: 'orWhereRaw',
                args: [this.transformRaw(sql)],
            });
        }
        return this;
    }
    /**
     * Alias for [[whereRaw]]
     */
    andWhereRaw(sql, bindings) {
        return this.whereRaw(sql, bindings);
    }
    /**
     * Add a `where like` clause
     */
    whereLike(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereLike',
            args: [this.resolveColumn(key), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Add a `where like` clause
     */
    orWhereLike(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereLike',
            args: [this.resolveColumn(key), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Add a `where like` clause
     */
    andWhereLike(key, value) {
        return this.whereLike(key, value);
    }
    /**
     * Add a `where like` clause
     */
    whereILike(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereILike',
            args: [this.resolveColumn(key), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Add a `where like` clause
     */
    orWhereILike(key, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereILike',
            args: [this.resolveColumn(key), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Add a `where like` clause
     */
    andWhereILike(key, value) {
        return this.whereILike(key, value);
    }
    /**
     * Define a where clause with value that matches for JSON
     */
    whereJson(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereJsonObject',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a or where clause with value that matches for JSON
     */
    orWhereJson(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereJsonObject',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a where clause with value that matches for JSON
     *
     * @alias whereJson
     */
    andWhereJson(column, value) {
        return this.whereJson(column, value);
    }
    /**
     * Define a where clause with value that matches for JSON
     */
    whereNotJson(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereNotJsonObject',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a or where clause with value that matches for JSON
     */
    orWhereNotJson(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereNotJsonObject',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a where clause with value that matches for JSON
     *
     * @alias whereNotJson
     */
    andWhereNotJson(column, value) {
        return this.whereNotJson(column, value);
    }
    /**
     * Define a where clause with value that matches for a superset of
     * JSON
     */
    whereJsonSuperset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereJsonSupersetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a or where clause with value that matches for a superset of
     * JSON
     */
    orWhereJsonSuperset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereJsonSupersetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define or where clause with value that matches for a superset of
     * JSON
     *
     * @alias whereJsonSuperset
     */
    andWhereJsonSuperset(column, value) {
        return this.whereJsonSuperset(column, value);
    }
    /**
     * Define a where clause with value that matches for a superset of
     * JSON
     */
    whereNotJsonSuperset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereJsonNotSupersetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a or where clause with value that matches for a superset of
     * JSON
     */
    orWhereNotJsonSuperset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereJsonNotSupersetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define or where clause with value that matches for a superset of
     * JSON
     *
     * @alias whereNotJsonSuperset
     */
    andWhereNotJsonSuperset(column, value) {
        return this.whereNotJsonSuperset(column, value);
    }
    /**
     * Define a where clause with value that matches for a subset of
     * JSON
     */
    whereJsonSubset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereJsonSubsetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a or where clause with value that matches for a subset of
     * JSON
     */
    orWhereJsonSubset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereJsonSubsetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define or where clause with value that matches for a subset of
     * JSON
     *
     * @alias whereJsonSubset
     */
    andWhereJsonSubset(column, value) {
        return this.whereJsonSubset(column, value);
    }
    /**
     * Define a where clause with value that matches for a subset of
     * JSON
     */
    whereNotJsonSubset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'whereJsonNotSubsetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define a or where clause with value that matches for a subset of
     * JSON
     */
    orWhereNotJsonSubset(column, value) {
        const whereClauses = this.getRecentStackItem();
        whereClauses.push({
            method: 'orWhereJsonNotSubsetOf',
            args: [this.resolveColumn(column), this.transformValue(value)],
        });
        return this;
    }
    /**
     * Define or where clause with value that matches for a subset of
     * JSON
     *
     * @alias whereNotJsonSubset
     */
    andWhereNotJsonSubset(column, value) {
        return this.whereNotJsonSubset(column, value);
    }
    /**
     * Adds a where clause with comparison of a value returned
     * by a JsonPath given an operator and a value.
     */
    whereJsonPath(column, jsonPath, operator, value) {
        const whereClauses = this.getRecentStackItem();
        if (!value) {
            value = operator;
            operator = '=';
        }
        whereClauses.push({
            method: 'whereJsonPath',
            args: [this.resolveColumn(column), jsonPath, operator, this.transformValue(value)],
        });
        return this;
    }
    /**
     * Adds a or where clause with comparison of a value returned
     * by a JsonPath given an operator and a value.
     */
    orWhereJsonPath(column, jsonPath, operator, value) {
        const whereClauses = this.getRecentStackItem();
        if (!value) {
            value = operator;
            operator = '=';
        }
        whereClauses.push({
            method: 'orWhereJsonPath',
            args: [this.resolveColumn(column), jsonPath, operator, this.transformValue(value)],
        });
        return this;
    }
    /**
     * Adds a where clause with comparison of a value returned
     * by a JsonPath given an operator and a value.
     *
     * @alias whereJsonPath
     */
    andWhereJsonPath(column, jsonPath, operator, value) {
        return this.whereJsonPath(column, jsonPath, operator, value);
    }
    /**
     * Add a join clause
     */
    join(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.join(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.join(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.join(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add an inner join clause
     */
    innerJoin(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.innerJoin(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.innerJoin(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.innerJoin(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add a left join clause
     */
    leftJoin(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.leftJoin(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.leftJoin(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.leftJoin(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add a left outer join clause
     */
    leftOuterJoin(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.leftOuterJoin(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.leftOuterJoin(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.leftOuterJoin(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add a right join clause
     */
    rightJoin(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.rightJoin(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.rightJoin(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.rightJoin(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add a right outer join clause
     */
    rightOuterJoin(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.rightOuterJoin(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.rightOuterJoin(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.rightOuterJoin(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add a full outer join clause
     */
    fullOuterJoin(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.fullOuterJoin(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.fullOuterJoin(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.fullOuterJoin(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add a cross join clause
     */
    crossJoin(table, first, operator, second) {
        if (second !== undefined) {
            this.knexQuery.crossJoin(table, first, operator, this.transformRaw(second));
        }
        else if (operator !== undefined) {
            this.knexQuery.crossJoin(table, first, this.transformRaw(operator));
        }
        else {
            this.knexQuery.crossJoin(table, this.transformRaw(first));
        }
        return this;
    }
    /**
     * Add join clause as a raw query
     */
    joinRaw(sql, bindings) {
        if (bindings) {
            this.knexQuery.joinRaw(sql, bindings);
        }
        else {
            this.knexQuery.joinRaw(this.transformRaw(sql));
        }
        return this;
    }
    /**
     * Adds a having clause. The having clause breaks for `postgreSQL` when
     * referencing alias columns, since PG doesn't support alias columns
     * being referred within `having` clause. The end user has to
     * use raw queries in this case.
     */
    having(key, operator, value) {
        if (value !== undefined) {
            this.knexQuery.having(this.resolveColumn(key), operator, this.transformValue(value));
            return this;
        }
        if (operator !== undefined) {
            throw new Exception('Invalid arguments for "queryBuilder.having". Excepts a callback or key-value pair along with an operator');
        }
        this.knexQuery.having(this.transformValue(key));
        return this;
    }
    /**
     * Adds or having clause. The having clause breaks for `postgreSQL` when
     * referencing alias columns, since PG doesn't support alias columns
     * being referred within `having` clause. The end user has to
     * use raw queries in this case.
     */
    orHaving(key, operator, value) {
        if (value !== undefined) {
            this.knexQuery.orHaving(this.resolveColumn(key), operator, this.transformValue(value));
            return this;
        }
        if (operator !== undefined) {
            throw new Exception('Invalid arguments for "queryBuilder.orHaving". Excepts a callback or key-value pair along with an operator');
        }
        this.knexQuery.orHaving(this.transformValue(key));
        return this;
    }
    /**
     * Alias for [[having]]
     */
    andHaving(key, operator, value) {
        return this.having(key, operator, value);
    }
    /**
     * Adding having in clause to the query
     */
    havingIn(key, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        this.knexQuery.havingIn(this.resolveColumn(key), value);
        return this;
    }
    /**
     * Adding or having in clause to the query
     */
    orHavingIn(key, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        this.knexQuery['orHavingIn'](this.resolveColumn(key), value);
        return this;
    }
    /**
     * Alias for [[havingIn]]
     */
    andHavingIn(key, value) {
        return this.havingIn(key, value);
    }
    /**
     * Adding having not in clause to the query
     */
    havingNotIn(key, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        this.knexQuery['havingNotIn'](this.resolveColumn(key), value);
        return this;
    }
    /**
     * Adding or having not in clause to the query
     */
    orHavingNotIn(key, value) {
        value = Array.isArray(value)
            ? value.map((one) => this.transformValue(one))
            : this.transformValue(value);
        this.knexQuery['orHavingNotIn'](this.resolveColumn(key), value);
        return this;
    }
    /**
     * Alias for [[havingNotIn]]
     */
    andHavingNotIn(key, value) {
        return this.havingNotIn(key, value);
    }
    /**
     * Adding having null clause
     */
    havingNull(key) {
        this.knexQuery['havingNull'](this.resolveColumn(key));
        return this;
    }
    /**
     * Adding or having null clause
     */
    orHavingNull(key) {
        ;
        this.knexQuery['orHavingNull'](this.resolveColumn(key));
        return this;
    }
    /**
     * Alias for [[havingNull]] clause
     */
    andHavingNull(key) {
        return this.havingNull(key);
    }
    /**
     * Adding having not null clause
     */
    havingNotNull(key) {
        this.knexQuery['havingNotNull'](this.resolveColumn(key));
        return this;
    }
    /**
     * Adding or having not null clause
     */
    orHavingNotNull(key) {
        ;
        this.knexQuery['orHavingNotNull'](this.resolveColumn(key));
        return this;
    }
    /**
     * Alias for [[havingNotNull]] clause
     */
    andHavingNotNull(key) {
        return this.havingNotNull(key);
    }
    /**
     * Adding `having exists` clause
     */
    havingExists(value) {
        ;
        this.knexQuery['havingExists'](this.transformValue(value));
        return this;
    }
    /**
     * Adding `or having exists` clause
     */
    orHavingExists(value) {
        ;
        this.knexQuery['orHavingExists'](this.transformValue(value));
        return this;
    }
    /**
     * Alias for [[havingExists]]
     */
    andHavingExists(value) {
        return this.havingExists(value);
    }
    /**
     * Adding `having not exists` clause
     */
    havingNotExists(value) {
        ;
        this.knexQuery['havingNotExists'](this.transformValue(value));
        return this;
    }
    /**
     * Adding `or having not exists` clause
     */
    orHavingNotExists(value) {
        ;
        this.knexQuery['orHavingNotExists'](this.transformValue(value));
        return this;
    }
    /**
     * Alias for [[havingNotExists]]
     */
    andHavingNotExists(value) {
        return this.havingNotExists(value);
    }
    /**
     * Adding `having between` clause
     */
    havingBetween(key, value) {
        this.knexQuery.havingBetween(this.resolveColumn(key), this.getBetweenPair(value));
        return this;
    }
    /**
     * Adding `or having between` clause
     */
    orHavingBetween(key, value) {
        this.knexQuery.orHavingBetween(this.resolveColumn(key), this.getBetweenPair(value));
        return this;
    }
    /**
     * Alias for [[havingBetween]]
     */
    andHavingBetween(key, value) {
        return this.havingBetween(this.resolveColumn(key), value);
    }
    /**
     * Adding `having not between` clause
     */
    havingNotBetween(key, value) {
        this.knexQuery.havingNotBetween(this.resolveColumn(key), this.getBetweenPair(value));
        return this;
    }
    /**
     * Adding `or having not between` clause
     */
    orHavingNotBetween(key, value) {
        this.knexQuery.orHavingNotBetween(this.resolveColumn(key), this.getBetweenPair(value));
        return this;
    }
    /**
     * Alias for [[havingNotBetween]]
     */
    andHavingNotBetween(key, value) {
        return this.havingNotBetween(key, value);
    }
    /**
     * Adding a where clause using raw sql
     */
    havingRaw(sql, bindings) {
        if (bindings) {
            this.knexQuery.havingRaw(sql, bindings);
        }
        else {
            this.knexQuery.havingRaw(this.transformRaw(sql));
        }
        return this;
    }
    /**
     * Adding a where clause using raw sql
     */
    orHavingRaw(sql, bindings) {
        if (bindings) {
            this.knexQuery.orHavingRaw(sql, bindings);
        }
        else {
            this.knexQuery.orHavingRaw(this.transformRaw(sql));
        }
        return this;
    }
    /**
     * Alias for [[havingRaw]]
     */
    andHavingRaw(sql, bindings) {
        return this.havingRaw(sql, bindings);
    }
    /**
     * Add distinct clause
     */
    distinct(...columns) {
        this.knexQuery.distinct(...columns.map((column) => this.resolveKey(column)));
        return this;
    }
    /**
     * Add distinctOn clause
     */
    distinctOn(...columns) {
        this.knexQuery.distinctOn(...columns.map((column) => this.resolveKey(column)));
        return this;
    }
    /**
     * Add group by clause
     */
    groupBy(...columns) {
        this.hasGroupBy = true;
        this.knexQuery.groupBy(...columns.map((column) => this.resolveKey(column)));
        return this;
    }
    /**
     * Add group by clause as a raw query
     */
    groupByRaw(sql, bindings) {
        this.hasGroupBy = true;
        if (bindings) {
            this.knexQuery.groupByRaw(sql, bindings);
        }
        else {
            this.knexQuery.groupByRaw(this.transformRaw(sql));
        }
        return this;
    }
    /**
     * Add order by clause
     */
    orderBy(column, direction) {
        if (typeof column === 'string') {
            this.knexQuery.orderBy(this.resolveKey(column), direction);
            return this;
        }
        /**
         * Here value can be one of the following
         * ['age', 'name']
         * [{ column: 'age', direction: 'desc' }]
         *
         * [{ column: Database.query().from('user_logins'), direction: 'desc' }]
         */
        if (Array.isArray(column)) {
            const transformedColumns = column.map((col) => {
                if (typeof col === 'string') {
                    return { column: this.resolveKey(col) };
                }
                if (col.column) {
                    col.column =
                        typeof col.column === 'string'
                            ? this.resolveKey(col.column)
                            : this.transformValue(col.column);
                    return col;
                }
                return col;
            });
            this.knexQuery.orderBy(transformedColumns);
            return this;
        }
        this.knexQuery.orderBy(this.transformValue(column), direction);
        return this;
    }
    /**
     * Add order by clause as a raw query
     */
    orderByRaw(sql, bindings) {
        if (bindings) {
            this.knexQuery.orderByRaw(sql, bindings);
        }
        else {
            this.knexQuery.orderByRaw(this.transformRaw(sql));
        }
        return this;
    }
    /**
     * Define select offset
     */
    offset(value) {
        this.knexQuery.offset(value);
        return this;
    }
    /**
     * Define results limit
     */
    limit(value) {
        this.knexQuery.limit(value);
        return this;
    }
    /**
     * Define union queries
     */
    union(queries, wrap) {
        this.hasUnion = true;
        queries = Array.isArray(queries)
            ? queries.map((one) => this.transformValue(one))
            : this.transformValue(queries);
        wrap !== undefined ? this.knexQuery.union(queries, wrap) : this.knexQuery.union(queries);
        return this;
    }
    /**
     * Define union all queries
     */
    unionAll(queries, wrap) {
        this.hasUnion = true;
        queries = Array.isArray(queries)
            ? queries.map((one) => this.transformValue(one))
            : this.transformValue(queries);
        wrap !== undefined ? this.knexQuery.unionAll(queries, wrap) : this.knexQuery.unionAll(queries);
        return this;
    }
    /**
     * Define intersect queries
     */
    intersect(queries, wrap) {
        queries = Array.isArray(queries)
            ? queries.map((one) => this.transformValue(one))
            : this.transformValue(queries);
        wrap !== undefined ? this.knexQuery.intersect(queries, wrap) : this.knexQuery.intersect(queries);
        return this;
    }
    /**
     * Clear select columns
     */
    clearSelect() {
        this.knexQuery.clearSelect();
        return this;
    }
    /**
     * Clear where clauses
     */
    clearWhere() {
        this.whereStack = [[]];
        this.knexQuery.clearWhere();
        return this;
    }
    /**
     * Clear order by
     */
    clearOrder() {
        this.knexQuery.clearOrder();
        return this;
    }
    /**
     * Clear having
     */
    clearHaving() {
        this.knexQuery.clearHaving();
        return this;
    }
    /**
     * Clear limit
     */
    clearLimit() {
        ;
        this.knexQuery['_single'].limit = null;
        return this;
    }
    /**
     * Clear offset
     */
    clearOffset() {
        ;
        this.knexQuery['_single'].offset = null;
        return this;
    }
    /**
     * Specify `FOR UPDATE` lock mode for a given
     * query
     */
    forUpdate(...tableNames) {
        this.knexQuery.forUpdate(...tableNames);
        return this;
    }
    /**
     * Specify `FOR SHARE` lock mode for a given
     * query
     */
    forShare(...tableNames) {
        this.knexQuery.forShare(...tableNames);
        return this;
    }
    /**
     * Skip locked rows
     */
    skipLocked() {
        this.knexQuery.skipLocked();
        return this;
    }
    /**
     * Fail when query wants a locked row
     */
    noWait() {
        this.knexQuery.noWait();
        return this;
    }
    /**
     * Define `with` CTE
     */
    with(alias, query, columns = []) {
        if (columns.length > 0) {
            this.knexQuery.with(alias, columns, this.transformValue(query));
        }
        else {
            this.knexQuery.with(alias, this.transformValue(query));
        }
        return this;
    }
    /**
     * Define `with` CTE with recursive keyword
     */
    withRecursive(alias, query, columns = []) {
        if (columns.length > 0) {
            this.knexQuery.withRecursive(alias, columns, this.transformValue(query));
        }
        else {
            this.knexQuery.withRecursive(alias, this.transformValue(query));
        }
        return this;
    }
    /**
     * Define `with materialized` CTE
     */
    withMaterialized(alias, query, columns = []) {
        if (columns.length > 0) {
            this.knexQuery.withMaterialized(alias, columns, this.transformValue(query));
        }
        else {
            this.knexQuery.withMaterialized(alias, this.transformValue(query));
        }
        return this;
    }
    /**
     * Define not `with materialized` CTE
     */
    withNotMaterialized(alias, query, columns = []) {
        if (columns.length > 0) {
            this.knexQuery.withNotMaterialized(alias, columns, this.transformValue(query));
        }
        else {
            this.knexQuery.withNotMaterialized(alias, this.transformValue(query));
        }
        return this;
    }
    /**
     * Define schema for the table
     */
    withSchema(schema) {
        this.knexQuery.withSchema(schema);
        return this;
    }
    /**
     * Define table alias
     */
    as(alias) {
        this.subQueryAlias = alias;
        this.knexQuery.as(alias);
        return this;
    }
    /**
     * Count rows for the current query
     */
    count(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.count(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * Count distinct rows for the current query
     */
    countDistinct(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.countDistinct(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * Make use of `min` aggregate function
     */
    min(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.min(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * Make use of `max` aggregate function
     */
    max(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.max(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * Make use of `avg` aggregate function
     */
    avg(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.avg(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * Make use of distinct `avg` aggregate function
     */
    avgDistinct(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.avgDistinct(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * Make use of `sum` aggregate function
     */
    sum(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.sum(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * Make use of distinct `sum` aggregate function
     */
    sumDistinct(columns, alias) {
        this.hasAggregates = true;
        this.knexQuery.sumDistinct(this.normalizeAggregateColumns(columns, alias));
        return this;
    }
    /**
     * A shorthand for applying offset and limit based upon
     * the current page
     */
    forPage(page, perPage) {
        /**
         * Calculate offset from current page and per page values
         */
        const offset = page === 1 ? 0 : perPage * (page - 1);
        this.offset(offset).limit(perPage);
        return this;
    }
    /**
     * Define a query to constraint to be defined when condition is truthy
     */
    if(condition, matchCallback, noMatchCallback) {
        let matched = condition;
        if (typeof condition === 'function') {
            matched = condition();
        }
        if (matched) {
            matchCallback(this);
        }
        else if (noMatchCallback) {
            noMatchCallback(this);
        }
        return this;
    }
    /**
     * Define a query to constraint to be defined when condition is falsy
     */
    unless(condition, matchCallback, noMatchCallback) {
        let matched = condition;
        if (typeof condition === 'function') {
            matched = condition();
        }
        if (!matched) {
            matchCallback(this);
        }
        else if (noMatchCallback) {
            noMatchCallback(this);
        }
        return this;
    }
    /**
     * Define matching blocks just like `if/else if and else`.
     */
    match(...blocks) {
        const matchingBlock = blocks.find((block) => {
            if (Array.isArray(block) && block.length === 2) {
                if (typeof block[0] === 'function' && block[0]()) {
                    return true;
                }
                else if (block[0]) {
                    return true;
                }
            }
            if (typeof block === 'function') {
                return true;
            }
        });
        if (!matchingBlock) {
            return this;
        }
        if (Array.isArray(matchingBlock)) {
            matchingBlock[1](this);
        }
        else {
            matchingBlock(this);
        }
        return this;
    }
    /**
     * Applies statements and returns knex query
     */
    toKnex() {
        this.applyWhere();
        return this.knexQuery;
    }
}
