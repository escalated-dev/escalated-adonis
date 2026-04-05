import { Knex } from 'knex';
import Macroable from '@poppinss/macroable';
import { ChainableContract, DBQueryCallback } from '../../types/querybuilder.js';
/**
 * The chainable query builder to construct SQL queries for selecting, updating and
 * deleting records.
 *
 * The API internally uses the knex query builder. However, many of methods may have
 * different API.
 */
export declare abstract class Chainable extends Macroable implements ChainableContract {
    knexQuery: Knex.QueryBuilder;
    private queryCallback;
    keysResolver?: ((columnName: string) => string) | undefined;
    hasAggregates: boolean;
    hasGroupBy: boolean;
    hasUnion: boolean;
    /**
     * Collection where clauses in a 2nd array. Calling `wrapExisting`
     * adds a new stack item
     */
    private whereStack;
    /**
     * Returns the recent most array from the where stack
     */
    private getRecentStackItem;
    /**
     * Returns the wrapping method for a given where method
     */
    private getWrappingMethod;
    /**
     * Applies the where clauses
     */
    protected applyWhere(): void;
    /**
     * An array of selected columns
     */
    get columns(): ChainableContract['columns'];
    /**
     * Custom alias for the query results. Ignored if it not a
     * subquery
     */
    subQueryAlias?: string;
    constructor(knexQuery: Knex.QueryBuilder, queryCallback: DBQueryCallback, keysResolver?: ((columnName: string) => string) | undefined);
    /**
     * Raises exception when only one argument is passed to a where
     * clause and it is a string. It means the value is undefined
     */
    private validateWhereSingleArgument;
    /**
     * Returns the value pair for the `whereBetween` clause
     */
    private getBetweenPair;
    /**
     * Normalizes the columns aggregates functions to something
     * knex can process.
     */
    private normalizeAggregateColumns;
    /**
     * Resolves the column name considering raw queries as well.
     */
    private resolveColumn;
    /**
     * Resolves column names
     */
    protected resolveKey(columns: any, checkForObject?: boolean, returnValue?: any): any;
    /**
     * Apply existing query flags to a new query builder. This is
     * done during clone operation
     */
    protected applyQueryFlags(query: Chainable): void;
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
    protected transformValue(value: any): any;
    /**
     * Transforms the user callback to something that knex
     * can internally process
     */
    protected transformCallback(value: any): any;
    /**
     * Returns the underlying knex raw query builder for Lucid raw
     * query builder
     */
    protected transformRaw(value: any): any;
    /**
     * Define columns for selection
     */
    select(...args: any[]): this;
    /**
     * Select table for the query. Re-calling this method multiple times will
     * use the last selected table
     */
    from(table: any): this;
    /**
     * Wrap existing where clauses to its own group
     */
    wrapExisting(): this;
    /**
     * Add a `where` clause
     */
    where(key: any, operator?: any, value?: any): this;
    /**
     * Add a `or where` clause
     */
    orWhere(key: any, operator?: any, value?: any): this;
    /**
     * Alias for `where`
     */
    andWhere(key: any, operator?: any, value?: any): this;
    /**
     * Adding `where not` clause
     */
    whereNot(key: any, operator?: any, value?: any): this;
    /**
     * Adding `or where not` clause
     */
    orWhereNot(key: any, operator?: any, value?: any): this;
    /**
     * Alias for [[whereNot]]
     */
    andWhereNot(key: any, operator?: any, value?: any): this;
    /**
     * Add a where clause on a given column
     */
    whereColumn(column: any, operator: any, comparisonColumn?: any): this;
    /**
     * Add a orWhere clause on a given column
     */
    orWhereColumn(column: any, operator: any, comparisonColumn?: any): this;
    /**
     * Alias for whereColumn
     */
    andWhereColumn(column: any, operator: any, comparisonColumn?: any): this;
    /**
     * Add a whereNot clause on a given column
     */
    whereNotColumn(column: any, operator: any, comparisonColumn?: any): this;
    /**
     * Add a orWhereNotColumn clause on a given column
     */
    orWhereNotColumn(column: any, operator: any, comparisonColumn?: any): this;
    /**
     * Alias for whereNotColumn
     */
    andWhereNotColumn(column: any, operator: any, comparisonColumn?: any): this;
    /**
     * Adding a `where in` clause
     */
    whereIn(columns: any, value: any): this;
    /**
     * Adding a `or where in` clause
     */
    orWhereIn(columns: any, value: any): this;
    /**
     * Alias for [[whereIn]]
     */
    andWhereIn(key: any, value: any): this;
    /**
     * Adding a `where not in` clause
     */
    whereNotIn(columns: any, value: any): this;
    /**
     * Adding a `or where not in` clause
     */
    orWhereNotIn(columns: any, value: any): this;
    /**
     * Alias for [[whereNotIn]]
     */
    andWhereNotIn(key: any, value: any): this;
    /**
     * Adding `where not null` clause
     */
    whereNull(key: any): this;
    /**
     * Adding `or where not null` clause
     */
    orWhereNull(key: any): this;
    /**
     * Alias for [[whereNull]]
     */
    andWhereNull(key: any): this;
    /**
     * Adding `where not null` clause
     */
    whereNotNull(key: any): this;
    /**
     * Adding `or where not null` clause
     */
    orWhereNotNull(key: any): this;
    /**
     * Alias for [[whereNotNull]]
     */
    andWhereNotNull(key: any): this;
    /**
     * Add a `where exists` clause
     */
    whereExists(value: any): this;
    /**
     * Add a `or where exists` clause
     */
    orWhereExists(value: any): this;
    /**
     * Alias for [[whereExists]]
     */
    andWhereExists(value: any): this;
    /**
     * Add a `where not exists` clause
     */
    whereNotExists(value: any): this;
    /**
     * Add a `or where not exists` clause
     */
    orWhereNotExists(value: any): this;
    /**
     * Alias for [[whereNotExists]]
     */
    andWhereNotExists(value: any): this;
    /**
     * Add where between clause
     */
    whereBetween(key: any, value: [any, any]): this;
    /**
     * Add where between clause
     */
    orWhereBetween(key: any, value: any): this;
    /**
     * Alias for [[whereBetween]]
     */
    andWhereBetween(key: any, value: any): this;
    /**
     * Add where between clause
     */
    whereNotBetween(key: any, value: any): this;
    /**
     * Add where between clause
     */
    orWhereNotBetween(key: any, value: any): this;
    /**
     * Alias for [[whereNotBetween]]
     */
    andWhereNotBetween(key: any, value: any): this;
    /**
     * Adding a where clause using raw sql
     */
    whereRaw(sql: any, bindings?: any): this;
    /**
     * Adding a or where clause using raw sql
     */
    orWhereRaw(sql: any, bindings?: any): this;
    /**
     * Alias for [[whereRaw]]
     */
    andWhereRaw(sql: any, bindings?: any): this;
    /**
     * Add a `where like` clause
     */
    whereLike(key: any, value: any): this;
    /**
     * Add a `where like` clause
     */
    orWhereLike(key: any, value?: any): this;
    /**
     * Add a `where like` clause
     */
    andWhereLike(key: any, value?: any): this;
    /**
     * Add a `where like` clause
     */
    whereILike(key: any, value?: any): this;
    /**
     * Add a `where like` clause
     */
    orWhereILike(key: any, value?: any): this;
    /**
     * Add a `where like` clause
     */
    andWhereILike(key: any, value?: any): this;
    /**
     * Define a where clause with value that matches for JSON
     */
    whereJson(column: string, value: any): this;
    /**
     * Define a or where clause with value that matches for JSON
     */
    orWhereJson(column: string, value: any): this;
    /**
     * Define a where clause with value that matches for JSON
     *
     * @alias whereJson
     */
    andWhereJson(column: string, value: any): this;
    /**
     * Define a where clause with value that matches for JSON
     */
    whereNotJson(column: string, value: any): this;
    /**
     * Define a or where clause with value that matches for JSON
     */
    orWhereNotJson(column: string, value: any): this;
    /**
     * Define a where clause with value that matches for JSON
     *
     * @alias whereNotJson
     */
    andWhereNotJson(column: string, value: any): this;
    /**
     * Define a where clause with value that matches for a superset of
     * JSON
     */
    whereJsonSuperset(column: string, value: any): this;
    /**
     * Define a or where clause with value that matches for a superset of
     * JSON
     */
    orWhereJsonSuperset(column: string, value: any): this;
    /**
     * Define or where clause with value that matches for a superset of
     * JSON
     *
     * @alias whereJsonSuperset
     */
    andWhereJsonSuperset(column: string, value: any): this;
    /**
     * Define a where clause with value that matches for a superset of
     * JSON
     */
    whereNotJsonSuperset(column: string, value: any): this;
    /**
     * Define a or where clause with value that matches for a superset of
     * JSON
     */
    orWhereNotJsonSuperset(column: string, value: any): this;
    /**
     * Define or where clause with value that matches for a superset of
     * JSON
     *
     * @alias whereNotJsonSuperset
     */
    andWhereNotJsonSuperset(column: string, value: any): this;
    /**
     * Define a where clause with value that matches for a subset of
     * JSON
     */
    whereJsonSubset(column: string, value: any): this;
    /**
     * Define a or where clause with value that matches for a subset of
     * JSON
     */
    orWhereJsonSubset(column: string, value: any): this;
    /**
     * Define or where clause with value that matches for a subset of
     * JSON
     *
     * @alias whereJsonSubset
     */
    andWhereJsonSubset(column: string, value: any): this;
    /**
     * Define a where clause with value that matches for a subset of
     * JSON
     */
    whereNotJsonSubset(column: string, value: any): this;
    /**
     * Define a or where clause with value that matches for a subset of
     * JSON
     */
    orWhereNotJsonSubset(column: string, value: any): this;
    /**
     * Define or where clause with value that matches for a subset of
     * JSON
     *
     * @alias whereNotJsonSubset
     */
    andWhereNotJsonSubset(column: string, value: any): this;
    /**
     * Adds a where clause with comparison of a value returned
     * by a JsonPath given an operator and a value.
     */
    whereJsonPath(column: string, jsonPath: string, operator: any, value?: any): this;
    /**
     * Adds a or where clause with comparison of a value returned
     * by a JsonPath given an operator and a value.
     */
    orWhereJsonPath(column: string, jsonPath: string, operator: any, value?: any): this;
    /**
     * Adds a where clause with comparison of a value returned
     * by a JsonPath given an operator and a value.
     *
     * @alias whereJsonPath
     */
    andWhereJsonPath(column: string, jsonPath: string, operator: any, value?: any): this;
    /**
     * Add a join clause
     */
    join(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add an inner join clause
     */
    innerJoin(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add a left join clause
     */
    leftJoin(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add a left outer join clause
     */
    leftOuterJoin(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add a right join clause
     */
    rightJoin(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add a right outer join clause
     */
    rightOuterJoin(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add a full outer join clause
     */
    fullOuterJoin(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add a cross join clause
     */
    crossJoin(table: any, first: any, operator?: any, second?: any): this;
    /**
     * Add join clause as a raw query
     */
    joinRaw(sql: any, bindings?: any): this;
    /**
     * Adds a having clause. The having clause breaks for `postgreSQL` when
     * referencing alias columns, since PG doesn't support alias columns
     * being referred within `having` clause. The end user has to
     * use raw queries in this case.
     */
    having(key: any, operator?: any, value?: any): this;
    /**
     * Adds or having clause. The having clause breaks for `postgreSQL` when
     * referencing alias columns, since PG doesn't support alias columns
     * being referred within `having` clause. The end user has to
     * use raw queries in this case.
     */
    orHaving(key: any, operator?: any, value?: any): this;
    /**
     * Alias for [[having]]
     */
    andHaving(key: any, operator?: any, value?: any): this;
    /**
     * Adding having in clause to the query
     */
    havingIn(key: any, value: any): this;
    /**
     * Adding or having in clause to the query
     */
    orHavingIn(key: any, value: any): this;
    /**
     * Alias for [[havingIn]]
     */
    andHavingIn(key: any, value: any): this;
    /**
     * Adding having not in clause to the query
     */
    havingNotIn(key: any, value: any): this;
    /**
     * Adding or having not in clause to the query
     */
    orHavingNotIn(key: any, value: any): this;
    /**
     * Alias for [[havingNotIn]]
     */
    andHavingNotIn(key: any, value: any): this;
    /**
     * Adding having null clause
     */
    havingNull(key: any): this;
    /**
     * Adding or having null clause
     */
    orHavingNull(key: any): this;
    /**
     * Alias for [[havingNull]] clause
     */
    andHavingNull(key: any): this;
    /**
     * Adding having not null clause
     */
    havingNotNull(key: any): this;
    /**
     * Adding or having not null clause
     */
    orHavingNotNull(key: any): this;
    /**
     * Alias for [[havingNotNull]] clause
     */
    andHavingNotNull(key: any): this;
    /**
     * Adding `having exists` clause
     */
    havingExists(value: any): this;
    /**
     * Adding `or having exists` clause
     */
    orHavingExists(value: any): this;
    /**
     * Alias for [[havingExists]]
     */
    andHavingExists(value: any): this;
    /**
     * Adding `having not exists` clause
     */
    havingNotExists(value: any): this;
    /**
     * Adding `or having not exists` clause
     */
    orHavingNotExists(value: any): this;
    /**
     * Alias for [[havingNotExists]]
     */
    andHavingNotExists(value: any): this;
    /**
     * Adding `having between` clause
     */
    havingBetween(key: any, value: any): this;
    /**
     * Adding `or having between` clause
     */
    orHavingBetween(key: any, value: any): this;
    /**
     * Alias for [[havingBetween]]
     */
    andHavingBetween(key: any, value: any): this;
    /**
     * Adding `having not between` clause
     */
    havingNotBetween(key: any, value: any): this;
    /**
     * Adding `or having not between` clause
     */
    orHavingNotBetween(key: any, value: any): this;
    /**
     * Alias for [[havingNotBetween]]
     */
    andHavingNotBetween(key: any, value: any): this;
    /**
     * Adding a where clause using raw sql
     */
    havingRaw(sql: any, bindings?: any): this;
    /**
     * Adding a where clause using raw sql
     */
    orHavingRaw(sql: any, bindings?: any): this;
    /**
     * Alias for [[havingRaw]]
     */
    andHavingRaw(sql: any, bindings?: any): this;
    /**
     * Add distinct clause
     */
    distinct(...columns: any[]): this;
    /**
     * Add distinctOn clause
     */
    distinctOn(...columns: any[]): this;
    /**
     * Add group by clause
     */
    groupBy(...columns: any[]): this;
    /**
     * Add group by clause as a raw query
     */
    groupByRaw(sql: any, bindings?: any): this;
    /**
     * Add order by clause
     */
    orderBy(column: any, direction?: any): this;
    /**
     * Add order by clause as a raw query
     */
    orderByRaw(sql: any, bindings?: any): this;
    /**
     * Define select offset
     */
    offset(value: number): this;
    /**
     * Define results limit
     */
    limit(value: number): this;
    /**
     * Define union queries
     */
    union(queries: any, wrap?: boolean): this;
    /**
     * Define union all queries
     */
    unionAll(queries: any, wrap?: boolean): this;
    /**
     * Define intersect queries
     */
    intersect(queries: any, wrap?: boolean): this;
    /**
     * Clear select columns
     */
    clearSelect(): this;
    /**
     * Clear where clauses
     */
    clearWhere(): this;
    /**
     * Clear order by
     */
    clearOrder(): this;
    /**
     * Clear having
     */
    clearHaving(): this;
    /**
     * Clear limit
     */
    clearLimit(): this;
    /**
     * Clear offset
     */
    clearOffset(): this;
    /**
     * Specify `FOR UPDATE` lock mode for a given
     * query
     */
    forUpdate(...tableNames: string[]): this;
    /**
     * Specify `FOR SHARE` lock mode for a given
     * query
     */
    forShare(...tableNames: string[]): this;
    /**
     * Skip locked rows
     */
    skipLocked(): this;
    /**
     * Fail when query wants a locked row
     */
    noWait(): this;
    /**
     * Define `with` CTE
     */
    with(alias: any, query: any, columns?: string[]): this;
    /**
     * Define `with` CTE with recursive keyword
     */
    withRecursive(alias: any, query: any, columns?: string[]): this;
    /**
     * Define `with materialized` CTE
     */
    withMaterialized(alias: any, query: any, columns?: string[]): this;
    /**
     * Define not `with materialized` CTE
     */
    withNotMaterialized(alias: any, query: any, columns?: string[]): this;
    /**
     * Define schema for the table
     */
    withSchema(schema: any): this;
    /**
     * Define table alias
     */
    as(alias: any): this;
    /**
     * Count rows for the current query
     */
    count(columns: any, alias?: any): this;
    /**
     * Count distinct rows for the current query
     */
    countDistinct(columns: any, alias?: any): this;
    /**
     * Make use of `min` aggregate function
     */
    min(columns: any, alias?: any): this;
    /**
     * Make use of `max` aggregate function
     */
    max(columns: any, alias?: any): this;
    /**
     * Make use of `avg` aggregate function
     */
    avg(columns: any, alias?: any): this;
    /**
     * Make use of distinct `avg` aggregate function
     */
    avgDistinct(columns: any, alias?: any): this;
    /**
     * Make use of `sum` aggregate function
     */
    sum(columns: any, alias?: any): this;
    /**
     * Make use of distinct `sum` aggregate function
     */
    sumDistinct(columns: any, alias?: any): this;
    /**
     * A shorthand for applying offset and limit based upon
     * the current page
     */
    forPage(page: number, perPage: number): this;
    /**
     * Define a query to constraint to be defined when condition is truthy
     */
    if(condition: any, matchCallback: (query: this) => any, noMatchCallback?: (query: this) => any): this;
    /**
     * Define a query to constraint to be defined when condition is falsy
     */
    unless(condition: any, matchCallback: (query: this) => any, noMatchCallback?: (query: this) => any): this;
    /**
     * Define matching blocks just like `if/else if and else`.
     */
    match(...blocks: ([condition: any, callback: (query: this) => any] | ((query: this) => any))[]): this;
    /**
     * Applies statements and returns knex query
     */
    toKnex(): Knex.QueryBuilder<any, any>;
}
