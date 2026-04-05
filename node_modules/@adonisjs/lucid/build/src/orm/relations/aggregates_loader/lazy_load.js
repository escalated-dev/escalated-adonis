/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
/**
 * An implementation for lazy loading model relationship aggregates
 */
export class LazyLoadAggregates {
    model;
    query;
    constructor(model) {
        this.model = model;
        /**
         * Model must be persisted before the lazy loading can happen
         */
        const Model = this.model.constructor;
        /**
         * The "refresh" query has the where clause already assigned
         */
        this.query = this.model.$getQueryFor('refresh', Model.$adapter.modelClient(this.model));
        /**
         * Selecting just the primary key
         */
        this.query.select(Model.primaryKey);
    }
    /**
     * Load aggregate of relationship
     */
    loadAggregate(relationName, userCallback) {
        this.query.withAggregate(relationName, userCallback);
        return this;
    }
    /**
     * Load count of relationship
     */
    loadCount(relationName, userCallback) {
        this.query.withCount(relationName, userCallback);
        return this;
    }
    /**
     * Execute query
     */
    async exec() {
        const result = await this.query.pojo().first();
        if (!result) {
            return;
        }
        /**
         * Consume adapter result
         */
        this.model.$consumeAdapterResult(result);
    }
    /**
     * Implementation of `then` for the promise API
     */
    then(resolve, reject) {
        return this.exec().then(resolve, reject);
    }
    /**
     * Implementation of `catch` for the promise API
     */
    catch(reject) {
        return this.exec().catch(reject);
    }
    /**
     * Implementation of `finally` for the promise API
     */
    finally(fullfilled) {
        return this.exec().finally(fullfilled);
    }
    /**
     * Required when Promises are extended
     */
    get [Symbol.toStringTag]() {
        return this.constructor.name;
    }
}
