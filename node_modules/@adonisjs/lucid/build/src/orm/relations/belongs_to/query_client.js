/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { managedTransaction } from '../../../utils/index.js';
import { BelongsToQueryBuilder } from './query_builder.js';
import { BelongsToSubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the belongsTo relationship.
 */
export class BelongsToQueryClient {
    relation;
    parent;
    client;
    constructor(relation, parent, client) {
        this.relation = relation;
        this.parent = parent;
        this.client = client;
    }
    /**
     * Generate a query builder instance
     */
    static query(client, relation, rows) {
        const query = new BelongsToQueryBuilder(client.knexQuery(), client, rows, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Generate a eager query
     */
    static eagerQuery(client, relation, rows) {
        const query = new BelongsToQueryBuilder(client.knexQuery(), client, rows, relation);
        query.isRelatedPreloadQuery = true;
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns an instance of the subquery
     */
    static subQuery(client, relation) {
        const query = new BelongsToSubQueryBuilder(client.knexQuery(), client, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns instance of query builder
     */
    query() {
        return BelongsToQueryClient.query(this.client, this.relation, this.parent);
    }
    /**
     * Associate the related model with the parent model
     */
    async associate(related) {
        await managedTransaction(this.parent.$trx || this.client, async (trx) => {
            related.$trx = trx;
            await related.save();
            this.relation.hydrateForPersistance(this.parent, related);
            this.parent.$trx = trx;
            await this.parent.save();
        });
    }
    /**
     * Drop association
     */
    async dissociate() {
        ;
        this.parent[this.relation.foreignKey] = null;
        await this.parent.save();
    }
}
