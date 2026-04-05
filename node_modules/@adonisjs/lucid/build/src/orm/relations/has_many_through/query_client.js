/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { HasManyThroughQueryBuilder } from './query_builder.js';
import { HasManyThroughSubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the defined
 * relationship
 */
export class HasManyThroughClient {
    relation;
    parent;
    client;
    constructor(relation, parent, client) {
        this.relation = relation;
        this.parent = parent;
        this.client = client;
    }
    /**
     * Generate a related query builder
     */
    static query(client, relation, rows) {
        const query = new HasManyThroughQueryBuilder(client.knexQuery(), client, rows, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Generate a related eager query builder
     */
    static eagerQuery(client, relation, rows) {
        const query = new HasManyThroughQueryBuilder(client.knexQuery(), client, rows, relation);
        query.isRelatedPreloadQuery = true;
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns an instance of the sub query
     */
    static subQuery(client, relation) {
        const query = new HasManyThroughSubQueryBuilder(client.knexQuery(), client, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns an instance of has many through query builder
     */
    query() {
        return HasManyThroughClient.query(this.client, this.relation, this.parent);
    }
}
