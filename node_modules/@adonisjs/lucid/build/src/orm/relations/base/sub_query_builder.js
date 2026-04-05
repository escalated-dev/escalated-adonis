/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { ModelQueryBuilder } from '../../query_builder/index.js';
/**
 * Base query builder for ORM Relationships
 */
export class BaseSubQueryBuilder extends ModelQueryBuilder {
    /**
     * The counter for the self join alias. Usually will be set by
     * the consumer
     */
    selfJoinCounter = 0;
    /**
     * Alias for the self join table
     */
    get selfJoinAlias() {
        return `adonis_temp_${this.selfJoinCounter}`;
    }
    /**
     * Is query a relationship query obtained using `related('relation').query()`
     */
    get isRelatedQuery() {
        return false;
    }
    /**
     * Is query a relationship query obtained using `related('relation').subQuery()`
     */
    get isRelatedSubQuery() {
        return true;
    }
    /**
     * Is query a relationship query obtained using one of the preload methods.
     */
    get isRelatedPreloadQuery() {
        return false;
    }
    constructor(builder, client, relation, dbCallback) {
        super(builder, relation.relatedModel(), client, dbCallback);
    }
    /**
     * Returns the selected columns
     */
    getSelectedColumns() {
        return this.knexQuery['_statements'].find(({ grouping }) => grouping === 'columns');
    }
    /**
     * Selects the relation keys. Invoked by the preloader
     */
    selectRelationKeys() {
        const columns = this.getSelectedColumns();
        /**
         * No columns have been defined, we will let knex do it's job by
         * adding `select *`
         */
        if (!columns) {
            return this;
        }
        /**
         * Finally push relation columns to existing selected columns
         */
        this.getRelationKeys().forEach((key) => {
            key = this.resolveKey(key);
            if (!columns.value.includes(key)) {
                columns.value.push(key);
            }
        });
        return this;
    }
    /**
     * Get query sql
     */
    toSQL() {
        this.prepare();
        return super.toSQL();
    }
    /**
     * prepare
     */
    prepare() {
        this.applyConstraints();
        return this;
    }
    /**
     * Executing subqueries is not allowed. It is disabled in static types, but
     * in case someone by-pass typescript checks to invoke it
     */
    exec() {
        throw new Error('Cannot execute relationship subqueries');
    }
    paginate() {
        throw new Error('Cannot execute relationship subqueries');
    }
    update() {
        throw new Error('Cannot execute relationship subqueries');
    }
    del() {
        throw new Error('Cannot execute relationship subqueries');
    }
    first() {
        throw new Error('Cannot execute relationship subqueries');
    }
    firstOrFail() {
        throw new Error('Cannot execute relationship subqueries');
    }
}
