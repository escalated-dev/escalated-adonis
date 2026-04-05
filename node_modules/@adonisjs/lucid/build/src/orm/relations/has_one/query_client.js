/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { managedTransaction } from '../../../utils/index.js';
import { HasOneQueryBuilder } from './query_builder.js';
import { HasOneSubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the defined
 * relationship
 */
export class HasOneQueryClient {
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
        const query = new HasOneQueryBuilder(client.knexQuery(), client, rows, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Generate a related eager query builder
     */
    static eagerQuery(client, relation, rows) {
        const query = new HasOneQueryBuilder(client.knexQuery(), client, rows, relation);
        query.isRelatedPreloadQuery = true;
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns an instance of the sub query builder
     */
    static subQuery(client, relation) {
        const query = new HasOneSubQueryBuilder(client.knexQuery(), client, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns instance of query builder
     */
    query() {
        return HasOneQueryClient.query(this.client, this.relation, this.parent);
    }
    /**
     * Save related model instance
     */
    async save(related) {
        await managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await this.parent.save();
            this.relation.hydrateForPersistance(this.parent, related);
            related.$trx = trx;
            await related.save();
        });
    }
    /**
     * Create instance of the related model
     */
    async create(values, options) {
        const parent = this.parent;
        return managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await parent.save();
            const valuesToPersist = Object.assign({}, values);
            this.relation.hydrateForPersistance(this.parent, valuesToPersist);
            return this.relation.relatedModel().create(valuesToPersist, { client: trx, ...options });
        });
    }
    /**
     * Get the first matching related instance or create a new one
     */
    async firstOrCreate(search, savePayload, options) {
        return managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await this.parent.save();
            const valuesToPersist = Object.assign({}, search);
            this.relation.hydrateForPersistance(this.parent, valuesToPersist);
            return this.relation
                .relatedModel()
                .firstOrCreate(valuesToPersist, savePayload, { client: trx, ...options });
        });
    }
    /**
     * Update the existing row or create a new one
     */
    async updateOrCreate(search, updatePayload, options) {
        return managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await this.parent.save();
            const valuesToPersist = Object.assign({}, search);
            this.relation.hydrateForPersistance(this.parent, valuesToPersist);
            return this.relation
                .relatedModel()
                .updateOrCreate(valuesToPersist, updatePayload, { client: trx, ...options });
        });
    }
}
