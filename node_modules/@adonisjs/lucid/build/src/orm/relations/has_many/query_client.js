/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { managedTransaction } from '../../../utils/index.js';
import { HasManyQueryBuilder } from './query_builder.js';
import { HasManySubQueryBuilder } from './sub_query_builder.js';
/**
 * Query client for executing queries in scope to the defined
 * relationship
 */
export class HasManyQueryClient {
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
    static query(client, relation, row) {
        const query = new HasManyQueryBuilder(client.knexQuery(), client, row, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Generate a related eager query builder
     */
    static eagerQuery(client, relation, rows) {
        const query = new HasManyQueryBuilder(client.knexQuery(), client, rows, relation);
        query.isRelatedPreloadQuery = true;
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns an instance of the sub query
     */
    static subQuery(client, relation) {
        const query = new HasManySubQueryBuilder(client.knexQuery(), client, relation);
        typeof relation.onQueryHook === 'function' && relation.onQueryHook(query);
        return query;
    }
    /**
     * Returns instance of query builder
     */
    query() {
        return HasManyQueryClient.query(this.client, this.relation, this.parent);
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
     * Save related model instance
     */
    async saveMany(related) {
        const parent = this.parent;
        await managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await parent.save();
            for (let row of related) {
                this.relation.hydrateForPersistance(this.parent, row);
                row.$trx = trx;
                await row.save();
            }
        });
    }
    /**
     * Create instance of the related model
     */
    async create(values, options) {
        return managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await this.parent.save();
            const valuesToPersist = Object.assign({}, values);
            this.relation.hydrateForPersistance(this.parent, valuesToPersist);
            return this.relation.relatedModel().create(valuesToPersist, { client: trx, ...options });
        });
    }
    /**
     * Create instance of the related model
     */
    async createMany(values, options) {
        const parent = this.parent;
        return managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await parent.save();
            const valuesToPersist = values.map((value) => {
                const valueToPersist = Object.assign({}, value);
                this.relation.hydrateForPersistance(this.parent, valueToPersist);
                return valueToPersist;
            });
            return this.relation.relatedModel().createMany(valuesToPersist, { client: trx, ...options });
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
    /**
     * Fetch the existing related rows or create new one's
     */
    async fetchOrCreateMany(payload, predicate, options) {
        return managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await this.parent.save();
            payload.forEach((row) => {
                this.relation.hydrateForPersistance(this.parent, row);
            });
            predicate = Array.isArray(predicate) ? predicate : predicate ? [predicate] : [];
            return this.relation
                .relatedModel()
                .fetchOrCreateMany(predicate.concat(this.relation.foreignKey), payload, {
                client: trx,
                ...options,
            });
        });
    }
    /**
     * Update the existing related rows or create new one's
     */
    async updateOrCreateMany(payload, predicate, options) {
        return managedTransaction(this.parent.$trx || this.client, async (trx) => {
            this.parent.$trx = trx;
            await this.parent.save();
            payload.forEach((row) => {
                this.relation.hydrateForPersistance(this.parent, row);
            });
            predicate = Array.isArray(predicate) ? predicate : predicate ? [predicate] : [];
            return this.relation
                .relatedModel()
                .updateOrCreateMany(predicate.concat(this.relation.foreignKey), payload, {
                client: trx,
                ...options,
            });
        });
    }
}
