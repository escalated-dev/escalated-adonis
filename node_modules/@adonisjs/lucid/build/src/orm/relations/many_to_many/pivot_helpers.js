/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { ManyToManySubQueryBuilder } from './sub_query_builder.js';
export class PivotHelpers {
    query;
    aliasSelectColumns;
    constructor(query, aliasSelectColumns) {
        this.query = query;
        this.aliasSelectColumns = aliasSelectColumns;
    }
    /**
     * Prefixes the pivot table name to a column
     */
    prefixPivotTable(column) {
        if (column.includes('.')) {
            return column;
        }
        if (this.query instanceof ManyToManySubQueryBuilder) {
            return `${this.query.relation.pivotTable}.${column}`;
        }
        return this.query.isPivotOnlyQuery ? column : `${this.query.relation.pivotTable}.${column}`;
    }
    /**
     * Adds a where pivot condition to the query
     */
    wherePivot(variation, key, operator, value) {
        let method = 'where';
        switch (variation) {
            case 'or':
                method = 'orWhere';
                break;
            case 'not':
                method = 'whereNot';
                break;
            case 'orNot':
                method = 'orWhereNot';
        }
        if (value !== undefined) {
            return this.query[method](this.prefixPivotTable(key), operator, value);
        }
        else if (operator !== undefined) {
            return this.query[method](this.prefixPivotTable(key), operator);
        }
        else {
            return this.query[method](key);
        }
    }
    /**
     * Adds a where pivot condition to the query
     */
    whereNullPivot(variation, key) {
        let method = 'whereNull';
        switch (variation) {
            case 'or':
                method = 'orWhereNull';
                break;
            case 'not':
                method = 'whereNotNull';
                break;
            case 'orNot':
                method = 'orWhereNotNull';
        }
        return this.query[method](this.prefixPivotTable(key));
    }
    /**
     * Adds a where pivot condition to the query
     */
    whereInPivot(variation, key, value) {
        let method = 'whereIn';
        switch (variation) {
            case 'or':
                method = 'orWhereIn';
                break;
            case 'not':
                method = 'whereNotIn';
                break;
            case 'orNot':
                method = 'orWhereNotIn';
        }
        key = Array.isArray(key)
            ? key.map((one) => this.prefixPivotTable(one))
            : this.prefixPivotTable(key);
        return this.query[method](key, value);
    }
    /**
     * Select pivot columns
     */
    pivotColumns(columns) {
        this.query.knexQuery.select(columns.map((column) => {
            if (this.aliasSelectColumns) {
                return `${this.prefixPivotTable(column)} as ${this.query.relation.pivotAlias(column)}`;
            }
            return this.prefixPivotTable(column);
        }));
        return this;
    }
}
